import { queryOne, execute } from '../db';

export async function generateUniquePickupCode(): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM packages WHERE pickup_code = ? AND DATE(stored_at) = ?',
      [code, today]
    );
    
    if (!existing) {
      return code;
    }
  }
  
  throw new Error('生成取件码失败，请稍后重试');
}

export function validatePickupCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export async function getPackageByPickupCode(code: string) {
  const sql = `
    SELECT 
      p.*,
      c.name as company_name,
      l.code as locker_code,
      l.zone as locker_zone,
      u.name as courier_name
    FROM packages p
    LEFT JOIN companies c ON p.company_id = c.id
    LEFT JOIN lockers l ON p.locker_id = l.id
    LEFT JOIN users u ON p.courier_id = u.id
    WHERE p.pickup_code = ? AND p.status = 'pending'
  `;
  
  return await queryOne(sql, [code]);
}
