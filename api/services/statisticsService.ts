import { queryOne, queryMany } from '../db';
import { StatisticsSummary, TrendData, CompanyStats } from '../../shared/types';

export async function getStatisticsSummary(): Promise<StatisticsSummary> {
  const today = new Date().toISOString().split('T')[0];

  const todayStored = (await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM packages WHERE DATE(stored_at) = ?",
    [today]
  ))?.count || 0;

  const todayPicked = (await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM packages WHERE DATE(picked_at) = ?",
    [today]
  ))?.count || 0;

  const pendingCount = (await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM packages WHERE status = 'pending'"
  ))?.count || 0;

  const totalStored = (await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM packages WHERE DATE(stored_at) = ?",
    [today]
  ))?.count || 0;

  const pickupRate = totalStored > 0 ? Math.round((todayPicked / totalStored) * 100) : 0;

  const expiredCount = (await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM packages WHERE status = 'expired' OR status = 'returned'"
  ))?.count || 0;

  const overdueCount = (await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM packages WHERE status = 'pending' AND julianday('now') - julianday(stored_at) > 2"
  ))?.count || 0;

  const pickedCount = (await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM packages WHERE status = 'picked'"
  ))?.count || 0;

  const todayInbound = todayStored;
  const todayOutbound = todayPicked;

  const totalInbound = (await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM packages"
  ))?.count || 0;

  const totalOutbound = pickedCount;

  return {
    todayStored,
    todayPicked,
    pendingCount,
    pickupRate,
    expiredCount,
    overdueCount,
    pickedCount,
    todayInbound,
    todayOutbound,
    totalInbound,
    totalOutbound,
  };
}

export async function getTrendData(days: number = 7): Promise<TrendData[]> {
  const sql = `
    SELECT 
      DATE(stored_at) as date,
      COUNT(*) as storedCount,
      SUM(CASE WHEN DATE(picked_at) = DATE(stored_at) THEN 1 ELSE 0 END) as pickedCount
    FROM packages
    WHERE stored_at >= DATE('now', '-' || ? || ' days')
    GROUP BY DATE(stored_at)
    ORDER BY date ASC
    LIMIT ?
  `;

  const data = await queryMany<{ date: string; storedCount: number; pickedCount: number }>(sql, [days, days]);

  const result: TrendData[] = [];
  const dataMap = new Map(data.map(d => [d.date, d]));

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayData = dataMap.get(dateStr);
    result.push({
      date: dateStr,
      storedCount: dayData?.storedCount || 0,
      pickedCount: dayData?.pickedCount || 0,
    });
  }

  return result;
}

export async function getCompanyStats(dateFrom?: string, dateTo?: string): Promise<CompanyStats[]> {
  let sql = `
    SELECT 
      c.id as companyId,
      c.name as companyName,
      COUNT(*) as storedCount,
      SUM(CASE WHEN p.status = 'picked' THEN 1 ELSE 0 END) as pickedCount,
      SUM(CASE WHEN p.status = 'returned' OR p.status = 'expired' THEN 1 ELSE 0 END) as returnedCount
    FROM packages p
    LEFT JOIN companies c ON p.company_id = c.id
  `;

  const params: any[] = [];
  const conditions: string[] = [];

  if (dateFrom) {
    conditions.push('DATE(p.stored_at) >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('DATE(p.stored_at) <= ?');
    params.push(dateTo);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY c.id, c.name ORDER BY storedCount DESC';

  return await queryMany<CompanyStats>(sql, params);
}

export async function getHourlyDistribution() {
  const sql = `
    SELECT 
      strftime('%H', stored_at) as hour,
      COUNT(*) as count
    FROM packages
    WHERE stored_at >= DATE('now', '-7 days')
    GROUP BY strftime('%H', stored_at)
    ORDER BY hour
  `;

  return await queryMany<{ hour: string; count: number }>(sql);
}

export async function getSizeDistribution() {
  const sql = `
    SELECT 
      l.size,
      COUNT(*) as count,
      SUM(CASE WHEN l.status = 'occupied' THEN 1 ELSE 0 END) as occupied
    FROM lockers l
    GROUP BY l.size
  `;

  return await queryMany<{ size: string; count: number; occupied: number }>(sql);
}

export async function getZoneDistribution() {
  const sql = `
    SELECT 
      l.zone,
      COUNT(*) as total,
      SUM(CASE WHEN l.status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN l.status = 'occupied' THEN 1 ELSE 0 END) as occupied
    FROM lockers l
    GROUP BY l.zone
    ORDER BY l.zone
  `;

  return await queryMany<{ zone: string; total: number; available: number; occupied: number }>(sql);
}
