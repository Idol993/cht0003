import { queryOne, queryMany, execute } from '../db';
import { Notification, NotificationType, User } from '../../shared/types';
import { addOperationLog } from './packageService';

interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  packageId?: number;
  phoneSuffix?: string;
}

export async function findResidentUserByPhoneSuffix(phoneSuffix: string): Promise<User | undefined> {
  const sql = `
    SELECT u.*, c.name as company_name
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE u.role = 'resident' AND u.phone LIKE ?
    LIMIT 1
  `;
  return await queryOne<User>(sql, [`%${phoneSuffix}`]);
}

export async function createNotification(params: CreateNotificationParams): Promise<Notification> {
  const { userId, type, title, content, packageId } = params;

  const sql = `
    INSERT INTO notifications (user_id, type, title, content, package_id, read)
    VALUES (?, ?, ?, ?, ?, 0)
  `;
  const result = await execute(sql, [userId, type, title, content, packageId || null]);

  const notification = await queryOne<Notification>(
    'SELECT * FROM notifications WHERE id = ?',
    [result.lastInsertRowid]
  );

  if (packageId && (type === 'reminder' || type === 'return')) {
    await addOperationLog(packageId, type === 'return' ? 'expire' : 'reminder', undefined, undefined, content);
  }

  return notification!;
}

export async function getUserNotifications(userId: number, limit: number = 50): Promise<Notification[]> {
  const sql = `
    SELECT * FROM notifications 
    WHERE user_id = ?
    ORDER BY created_at DESC 
    LIMIT ?
  `;
  return await queryMany<Notification>(sql, [userId, limit]);
}

export async function getUnreadCount(userId: number): Promise<number> {
  const result = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
    [userId]
  );
  return result?.count || 0;
}

export async function markAsRead(notificationId: number, userId: number): Promise<void> {
  await execute(
    'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );
}

export async function markAllAsRead(userId: number): Promise<void> {
  await execute(
    'UPDATE notifications SET read = 1 WHERE user_id = ?',
    [userId]
  );
}

export async function sendOverdueReminders(): Promise<number> {
  const sql = `
    SELECT p.*, c.name as company_name, l.code as locker_code, l.zone as locker_zone
    FROM packages p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN lockers l ON p.locker_id = l.id
    WHERE p.status = 'pending'
    AND julianday('now') - julianday(p.stored_at) > 2
    AND (
      p.last_reminder_at IS NULL 
      OR julianday('now') - julianday(p.last_reminder_at) >= 1
    )
  `;

  const overduePackages = await queryMany<any>(sql);
  let count = 0;

  for (const pkg of overduePackages) {
    const days = Math.floor(
      (Date.now() - new Date(pkg.stored_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const residentUser = await findResidentUserByPhoneSuffix(pkg.phone_suffix);
    if (residentUser) {
      await createNotification({
        userId: residentUser.id,
        type: 'reminder',
        title: '取件提醒',
        content: `您的${pkg.company_name}快递（运单：${pkg.tracking_no}）已存放${days}天，请尽快到${pkg.locker_zone}${pkg.locker_code}格口取件，取件码：${pkg.pickup_code}`,
        packageId: pkg.id,
        phoneSuffix: pkg.phone_suffix,
      });
    } else {
      await addOperationLog(pkg.id, 'reminder', undefined, undefined, `未找到匹配居民用户（尾号${pkg.phone_suffix}），跳过逾期提醒通知`);
    }

    await execute(
      'UPDATE packages SET last_reminder_at = CURRENT_TIMESTAMP WHERE id = ?',
      [pkg.id]
    );

    count++;
  }

  return count;
}

export async function sendExpiredNotifications(): Promise<number> {
  const sql = `
    SELECT p.*, c.name as company_name, u.name as courier_name, u.phone as courier_phone
    FROM packages p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN users u ON p.courier_id = u.id
    WHERE p.status = 'pending'
    AND julianday('now') - julianday(p.stored_at) > 7
  `;

  const expiredPackages = await queryMany<any>(sql);
  let count = 0;

  for (const pkg of expiredPackages) {
    await createNotification({
      userId: pkg.courier_id,
      type: 'return',
      title: '包裹退回通知',
      content: `运单${pkg.tracking_no}（${pkg.company_name}）已存放超过7天无人领取，请尽快到驿站处理退回，存放位置：${pkg.locker_code}`,
      packageId: pkg.id,
    });

    await execute(
      'UPDATE packages SET status = ?, last_reminder_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['expired', pkg.id]
    );

    await addOperationLog(pkg.id, 'expire', undefined, undefined, '存放超7天，通知快递员退回');

    count++;
  }

  return count;
}
