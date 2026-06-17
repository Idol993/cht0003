import { queryOne, queryMany, execute } from '../db';
import { Notification, NotificationType, User, NotificationDelivery, DeliveryStatusType, NotificationQueryParams, DeliveryQueryParams } from '../../shared/types';
import { addOperationLog } from './packageService';

interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  packageId?: number;
  phoneSuffix?: string;
  deliveryId?: number;
}

interface CreateDeliveryRecordParams {
  packageId: number;
  notificationType: NotificationType;
  status: DeliveryStatusType;
  recipientUserId?: number;
  matchedCount?: number;
  matchedUserIds?: string;
  remark?: string;
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

export async function findResidentUsersByPhoneSuffix(phoneSuffix: string): Promise<User[]> {
  const sql = `
    SELECT u.*, c.name as company_name
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE u.role = 'resident' AND u.phone LIKE ?
  `;
  return await queryMany<User>(sql, [`%${phoneSuffix}`]);
}

export async function createNotification(params: CreateNotificationParams): Promise<Notification> {
  const { userId, type, title, content, packageId, deliveryId } = params;

  const sql = `
    INSERT INTO notifications (user_id, type, title, content, package_id, delivery_id, read)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `;
  const result = await execute(sql, [userId, type, title, content, packageId || null, deliveryId || null]);

  const notification = await queryOne<Notification>(
    'SELECT * FROM notifications WHERE id = ?',
    [result.lastInsertRowid]
  );

  if (packageId && (type === 'reminder' || type === 'return')) {
    await addOperationLog(packageId, type === 'return' ? 'expire' : 'reminder', undefined, undefined, content);
  }

  return notification!;
}

export async function createDeliveryRecord(params: CreateDeliveryRecordParams): Promise<NotificationDelivery> {
  const { packageId, notificationType, status, recipientUserId, matchedCount, matchedUserIds, remark } = params;

  const sql = `
    INSERT INTO notification_deliveries (
      package_id, notification_type, status, recipient_user_id,
      matched_count, matched_user_ids, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const result = await execute(sql, [
    packageId,
    notificationType,
    status,
    recipientUserId || null,
    matchedCount || 0,
    matchedUserIds || null,
    remark || null,
  ]);

  return (await getDeliveryById(result.lastInsertRowid as number))!;
}

async function getDeliveryById(id: number): Promise<NotificationDelivery | undefined> {
  const sql = `
    SELECT 
      nd.*,
      p.tracking_no,
      u.name as recipient_name,
      u.phone as recipient_phone
    FROM notification_deliveries nd
    LEFT JOIN packages p ON nd.package_id = p.id
    LEFT JOIN users u ON nd.recipient_user_id = u.id
    WHERE nd.id = ?
  `;
  const delivery = await queryOne<any>(sql, [id]);
  return delivery ? mapDelivery(delivery) : undefined;
}

function mapDelivery(dbDelivery: any): NotificationDelivery {
  return {
    id: dbDelivery.id,
    packageId: dbDelivery.package_id,
    trackingNumber: dbDelivery.tracking_no,
    notificationType: dbDelivery.notification_type,
    status: dbDelivery.status,
    recipientUserId: dbDelivery.recipient_user_id || undefined,
    recipientPhone: dbDelivery.recipient_phone || undefined,
    recipientName: dbDelivery.recipient_name || undefined,
    matchedCount: dbDelivery.matched_count || 0,
    matchedUserIds: dbDelivery.matched_user_ids ? dbDelivery.matched_user_ids.split(',').map(Number) : undefined,
    sentAt: dbDelivery.sent_at || dbDelivery.created_at,
    remark: dbDelivery.remark || undefined,
  };
}

export async function getDeliveriesByPackageId(packageId: number): Promise<NotificationDelivery[]> {
  const sql = `
    SELECT 
      nd.*,
      p.tracking_no,
      u.name as recipient_name,
      u.phone as recipient_phone
    FROM notification_deliveries nd
    LEFT JOIN packages p ON nd.package_id = p.id
    LEFT JOIN users u ON nd.recipient_user_id = u.id
    WHERE nd.package_id = ?
    ORDER BY nd.sent_at DESC
  `;
  const deliveries = await queryMany<any>(sql, [packageId]);
  return deliveries.map(mapDelivery);
}

export async function getAllDeliveries(params: DeliveryQueryParams = {}): Promise<NotificationDelivery[]> {
  let sql = `
    SELECT 
      nd.*,
      p.tracking_no,
      u.name as recipient_name,
      u.phone as recipient_phone
    FROM notification_deliveries nd
    LEFT JOIN packages p ON nd.package_id = p.id
    LEFT JOIN users u ON nd.recipient_user_id = u.id
  `;

  const whereConditions: string[] = [];
  const sqlParams: any[] = [];

  if (params.packageId) {
    whereConditions.push('nd.package_id = ?');
    sqlParams.push(params.packageId);
  }
  if (params.notificationType) {
    whereConditions.push('nd.notification_type = ?');
    sqlParams.push(params.notificationType);
  }
  if (params.status) {
    whereConditions.push('nd.status = ?');
    sqlParams.push(params.status);
  }
  if (params.startDate) {
    whereConditions.push('DATE(nd.sent_at) >= ?');
    sqlParams.push(params.startDate);
  }
  if (params.endDate) {
    whereConditions.push('DATE(nd.sent_at) <= ?');
    sqlParams.push(params.endDate);
  }

  if (whereConditions.length > 0) {
    sql += ' WHERE ' + whereConditions.join(' AND ');
  }

  sql += ' ORDER BY nd.sent_at DESC LIMIT 500';

  const deliveries = await queryMany<any>(sql, sqlParams);
  return deliveries.map(mapDelivery);
}

export async function getUserNotifications(userId: number, params: NotificationQueryParams = {}): Promise<Notification[]> {
  const { type, unreadOnly, limit = 50 } = params;

  let sql = `
    SELECT * FROM notifications 
    WHERE user_id = ?
  `;
  const sqlParams: any[] = [userId];

  if (type) {
    sql += ' AND type = ?';
    sqlParams.push(type);
  }
  if (unreadOnly) {
    sql += ' AND read = 0';
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  sqlParams.push(limit);

  return await queryMany<Notification>(sql, sqlParams);
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

async function getCompanyName(companyId: number): Promise<string> {
  const result = await queryOne<{ name: string }>(
    'SELECT name FROM companies WHERE id = ?',
    [companyId]
  );
  return result?.name || '快递';
}

async function updatePackageDeliveryStatus(
  packageId: number,
  deliveryStatus: string,
  residentId?: number,
  conflictCount?: number,
  matchedUserIds?: string
): Promise<void> {
  const sql = `
    UPDATE packages 
    SET delivery_status = ?, resident_id = ?, conflict_count = ?, matched_user_ids = ?
    WHERE id = ?
  `;
  await execute(sql, [
    deliveryStatus,
    residentId || null,
    conflictCount || 0,
    matchedUserIds || null,
    packageId,
  ]);
}

export async function sendPickupNotification(packageId: number): Promise<void> {
  const pkgSql = `
    SELECT p.*, c.name as company_name, l.code as locker_code, l.zone as locker_zone
    FROM packages p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN lockers l ON p.locker_id = l.id
    WHERE p.id = ?
  `;
  const pkg = await queryOne<any>(pkgSql, [packageId]);
  if (!pkg) return;

  const matchedUsers = await findResidentUsersByPhoneSuffix(pkg.phone_suffix);
  const matchCount = matchedUsers.length;

  if (matchCount === 0) {
    await createDeliveryRecord({
      packageId,
      notificationType: 'pickup',
      status: 'no_match',
      remark: '未找到匹配居民',
    });
    await addOperationLog(packageId, 'store', undefined, undefined, '未找到匹配居民用户，跳过通知');
    await updatePackageDeliveryStatus(packageId, 'conflict', undefined, 0);
  } else if (matchCount === 1) {
    const user = matchedUsers[0];
    const delivery = await createDeliveryRecord({
      packageId,
      notificationType: 'pickup',
      status: 'success',
      recipientUserId: user.id,
    });
    await createNotification({
      userId: user.id,
      type: 'pickup',
      title: '快递已送达',
      content: `您的${pkg.company_name}快递已存入${pkg.locker_zone}${pkg.locker_code}格口，取件码：${pkg.pickup_code}`,
      packageId,
      deliveryId: delivery.id,
    });
    await updatePackageDeliveryStatus(packageId, 'delivered', user.id);
  } else {
    const matchedUserIds = matchedUsers.map(u => u.id).join(',');
    const delivery = await createDeliveryRecord({
      packageId,
      notificationType: 'pickup',
      status: 'blocked_conflict',
      matchedCount: matchCount,
      matchedUserIds,
    });
    for (const user of matchedUsers) {
      await createNotification({
        userId: user.id,
        type: 'claim',
        title: '包裹待认领',
        content: `有一个尾号为${pkg.phone_suffix}的包裹待您认领，请登录系统查看详情`,
        packageId,
        deliveryId: delivery.id,
      });
    }
    await updatePackageDeliveryStatus(packageId, 'conflict', undefined, matchCount, matchedUserIds);
  }
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

    const matchedUsers = await findResidentUsersByPhoneSuffix(pkg.phone_suffix);
    const matchCount = matchedUsers.length;

    if (matchCount === 0) {
      await createDeliveryRecord({
        packageId: pkg.id,
        notificationType: 'reminder',
        status: 'no_match',
        remark: '未找到匹配居民',
      });
      await addOperationLog(pkg.id, 'reminder', undefined, undefined, `未找到匹配居民用户（尾号${pkg.phone_suffix}），跳过逾期提醒通知`);
    } else if (matchCount === 1) {
      const user = matchedUsers[0];
      const delivery = await createDeliveryRecord({
        packageId: pkg.id,
        notificationType: 'reminder',
        status: 'success',
        recipientUserId: user.id,
      });
      await createNotification({
        userId: user.id,
        type: 'reminder',
        title: '取件提醒',
        content: `您的${pkg.company_name}快递（运单：${pkg.tracking_no}）已存放${days}天，请尽快到${pkg.locker_zone}${pkg.locker_code}格口取件，取件码：${pkg.pickup_code}`,
        packageId: pkg.id,
        deliveryId: delivery.id,
      });
    } else {
      const matchedUserIds = matchedUsers.map(u => u.id).join(',');
      const delivery = await createDeliveryRecord({
        packageId: pkg.id,
        notificationType: 'reminder',
        status: 'blocked_conflict',
        matchedCount: matchCount,
        matchedUserIds,
      });
      for (const user of matchedUsers) {
        await createNotification({
          userId: user.id,
          type: 'claim',
          title: '包裹待认领',
          content: `有一个尾号为${pkg.phone_suffix}的包裹已存放${days}天待您认领，请登录系统查看详情`,
          packageId: pkg.id,
          deliveryId: delivery.id,
        });
      }
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
    SELECT p.*, c.name as company_name, l.code as locker_code, l.zone as locker_zone, u.name as courier_name, u.phone as courier_phone
    FROM packages p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN lockers l ON p.locker_id = l.id
    LEFT JOIN users u ON p.courier_id = u.id
    WHERE p.status = 'pending'
    AND julianday('now') - julianday(p.stored_at) > 7
  `;

  const expiredPackages = await queryMany<any>(sql);
  let count = 0;

  for (const pkg of expiredPackages) {
    const delivery = await createDeliveryRecord({
      packageId: pkg.id,
      notificationType: 'return',
      status: 'success',
      recipientUserId: pkg.courier_id,
    });

    await createNotification({
      userId: pkg.courier_id,
      type: 'return',
      title: '包裹退回通知',
      content: `您有一个包裹已存放满7天，请及时处理退回。运单号：${pkg.tracking_no}，快递公司：${pkg.company_name}，位置：${pkg.locker_zone}${pkg.locker_code}`,
      packageId: pkg.id,
      deliveryId: delivery.id,
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

export async function sendClaimPickupNotification(packageId: number, userId: number): Promise<void> {
  const pkgSql = `
    SELECT p.*, c.name as company_name, l.code as locker_code, l.zone as locker_zone
    FROM packages p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN lockers l ON p.locker_id = l.id
    WHERE p.id = ?
  `;
  const pkg = await queryOne<any>(pkgSql, [packageId]);
  if (!pkg) return;

  const delivery = await createDeliveryRecord({
    packageId,
    notificationType: 'pickup',
    status: 'success',
    recipientUserId: userId,
  });

  await createNotification({
    userId,
    type: 'pickup',
    title: '快递已送达',
    content: `您的${pkg.company_name}快递已存入${pkg.locker_zone}${pkg.locker_code}格口，取件码：${pkg.pickup_code}`,
    packageId,
    deliveryId: delivery.id,
  });
}
