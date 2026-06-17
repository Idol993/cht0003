import { queryOne, queryMany, execute } from '../db';
import { Locker, LockerSize, LockerStatus } from '../../shared/types';

interface LockerDb {
  id: number;
  code: string;
  zone: string;
  size: LockerSize;
  status: LockerStatus;
  current_package_id?: number;
}

function mapLocker(dbLocker: LockerDb): Locker {
  return {
    id: dbLocker.id,
    code: dbLocker.code,
    zone: dbLocker.zone,
    size: dbLocker.size,
    status: dbLocker.status,
    currentPackageId: dbLocker.current_package_id,
  };
}

export async function getAllLockers(): Promise<Locker[]> {
  const sql = 'SELECT * FROM lockers ORDER BY zone, code';
  const lockers = await queryMany<LockerDb>(sql);
  return lockers.map(mapLocker);
}

export async function getAvailableLocker(preferredSize?: LockerSize): Promise<Locker> {
  let sql = `
    SELECT * FROM lockers 
    WHERE status = 'available' 
  `;
  const params: any[] = [];

  if (preferredSize) {
    sql += 'AND size = ? ';
    params.push(preferredSize);
  }

  sql += 'ORDER BY zone, code LIMIT 1';
  
  const locker = await queryOne<LockerDb>(sql, params);
  if (!locker) {
    if (preferredSize) {
      return await getAvailableLocker();
    }
    throw new Error('暂无可用格口');
  }
  
  return mapLocker(locker);
}

export async function getLockerById(id: number): Promise<Locker | undefined> {
  const sql = 'SELECT * FROM lockers WHERE id = ?';
  const locker = await queryOne<LockerDb>(sql, [id]);
  return locker ? mapLocker(locker) : undefined;
}

export async function updateLockerStatus(
  id: number,
  status: LockerStatus,
  packageId?: number
): Promise<void> {
  const sql = `
    UPDATE lockers 
    SET status = ?, current_package_id = ?
    WHERE id = ?
  `;
  await execute(sql, [status, packageId || null, id]);
}

export async function createLocker(
  code: string,
  zone: string,
  size: LockerSize
): Promise<Locker> {
  const existing = await queryOne<LockerDb>('SELECT * FROM lockers WHERE code = ?', [code]);
  if (existing) {
    throw new Error('格口编号已存在');
  }

  const sql = `
    INSERT INTO lockers (code, zone, size, status)
    VALUES (?, ?, ?, 'available')
  `;
  const result = await execute(sql, [code, zone, size]);
  
  const locker = await getLockerById(result.lastInsertRowid as number);
  if (!locker) {
    throw new Error('创建格口失败');
  }
  
  return locker;
}

export async function updateLocker(
  id: number,
  code: string,
  zone: string,
  size: LockerSize,
  status: LockerStatus
): Promise<Locker> {
  const existing = await queryOne<LockerDb>('SELECT * FROM lockers WHERE code = ? AND id != ?', [code, id]);
  if (existing) {
    throw new Error('格口编号已存在');
  }

  const sql = `
    UPDATE lockers 
    SET code = ?, zone = ?, size = ?, status = ?
    WHERE id = ?
  `;
  await execute(sql, [code, zone, size, status, id]);
  
  const locker = await getLockerById(id);
  if (!locker) {
    throw new Error('更新格口失败');
  }
  
  return locker;
}

export async function getLockerStats() {
  const total = await queryOne<{ total: number; available: number; occupied: number }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied
    FROM lockers
  `);
  
  const byZone = await queryMany<{ zone: string; total: number; available: number; occupied: number }>(`
    SELECT 
      zone,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied
    FROM lockers
    GROUP BY zone
    ORDER BY zone
  `);
  
  return {
    total: total?.total || 0,
    available: total?.available || 0,
    occupied: total?.occupied || 0,
    byZone,
  };
}
