import { queryOne, queryMany, execute } from '../db';
import { Reservation, ReservationStatus, ReservationSize, UserRole } from '../../shared/types';

interface ReservationDb {
  id: number;
  resident_id: number;
  item_description: string;
  item_size: ReservationSize;
  expected_date: string;
  status: ReservationStatus;
  locker_id?: number;
  created_at: string;
  resident_name: string;
  resident_phone: string;
  locker_code?: string;
}

function mapReservation(db: ReservationDb): Reservation {
  return {
    id: db.id,
    residentId: db.resident_id,
    residentName: db.resident_name,
    residentPhone: db.resident_phone,
    itemName: db.item_description,
    phone: db.resident_phone,
    size: db.item_size,
    expectedDate: db.expected_date,
    status: db.status,
    lockerId: db.locker_id,
    lockerCode: db.locker_code,
    createdAt: db.created_at,
  };
}

const baseQuery = `
  SELECT 
    r.*,
    u.name as resident_name,
    u.phone as resident_phone,
    l.code as locker_code
  FROM reservations r
  LEFT JOIN users u ON r.resident_id = u.id
  LEFT JOIN lockers l ON r.locker_id = l.id
`;

export async function createReservation(
  residentId: number,
  itemName: string,
  size: ReservationSize,
  expectedDate: string
): Promise<Reservation> {
  const sql = `
    INSERT INTO reservations (resident_id, item_description, item_size, expected_date, status)
    VALUES (?, ?, ?, ?, 'pending')
  `;
  const result = await execute(sql, [residentId, itemName, size, expectedDate]);
  
  const reservation = await getReservationById(result.lastInsertRowid as number);
  if (!reservation) {
    throw new Error('预约创建失败');
  }
  
  return reservation;
}

export async function getReservations(
  userRole: UserRole,
  userId: number,
  status?: ReservationStatus
): Promise<Reservation[]> {
  let sql = baseQuery;
  const params: any[] = [];
  const conditions: string[] = [];

  if (userRole === 'resident') {
    conditions.push('r.resident_id = ?');
    params.push(userId);
  }

  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY r.created_at DESC';

  const reservations = await queryMany<ReservationDb>(sql, params);
  return reservations.map(mapReservation);
}

export async function getReservationById(id: number): Promise<Reservation | undefined> {
  const sql = baseQuery + ' WHERE r.id = ?';
  const reservation = await queryOne<ReservationDb>(sql, [id]);
  return reservation ? mapReservation(reservation) : undefined;
}

export async function approveReservation(
  id: number,
  lockerId?: number
): Promise<Reservation> {
  const reservation = await getReservationById(id);
  if (!reservation) {
    throw new Error('预约不存在');
  }
  if (reservation.status !== 'pending') {
    throw new Error('只能审核待处理的预约');
  }

  const sql = `
    UPDATE reservations 
    SET status = 'approved', locker_id = ?
    WHERE id = ?
  `;
  await execute(sql, [lockerId || null, id]);

  const updated = await getReservationById(id);
  if (!updated) {
    throw new Error('审核失败');
  }
  
  return updated;
}

export async function rejectReservation(id: number, reason?: string): Promise<Reservation> {
  const reservation = await getReservationById(id);
  if (!reservation) {
    throw new Error('预约不存在');
  }
  if (reservation.status !== 'pending') {
    throw new Error('只能拒绝待处理的预约');
  }

  await execute("UPDATE reservations SET status = 'rejected' WHERE id = ?", [id]);

  const updated = await getReservationById(id);
  if (!updated) {
    throw new Error('拒绝失败');
  }
  
  return updated;
}

export async function completeReservation(id: number): Promise<Reservation> {
  await execute("UPDATE reservations SET status = 'completed' WHERE id = ?", [id]);
  
  const updated = await getReservationById(id);
  if (!updated) {
    throw new Error('操作失败');
  }
  
  return updated;
}

export async function cancelReservation(id: number, userId: number, userRole: UserRole): Promise<Reservation> {
  const reservation = await getReservationById(id);
  if (!reservation) {
    throw new Error('预约不存在');
  }
  
  if (userRole === 'resident' && reservation.residentId !== userId) {
    throw new Error('只能取消自己的预约');
  }
  
  if (reservation.status !== 'pending' && reservation.status !== 'approved') {
    throw new Error('该状态下无法取消预约');
  }

  await execute("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [id]);

  const updated = await getReservationById(id);
  if (!updated) {
    throw new Error('取消失败');
  }
  
  return updated;
}
