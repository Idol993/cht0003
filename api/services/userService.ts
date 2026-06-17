import { queryOne, queryMany, execute } from '../db';
import { User, UserRole, Company } from '../../shared/types';

interface UserDb {
  id: number;
  phone: string;
  name: string;
  role: UserRole;
  company_id?: number;
  status: string;
  created_at: string;
  company_name?: string;
}

function mapUser(db: UserDb): User {
  return {
    id: db.id,
    phone: db.phone,
    name: db.name,
    role: db.role,
    companyId: db.company_id,
    companyName: db.company_name,
    status: db.status as 'active' | 'inactive',
    createdAt: db.created_at,
  };
}

const baseQuery = `
  SELECT u.*, c.name as company_name
  FROM users u
  LEFT JOIN companies c ON u.company_id = c.id
`;

export async function getAllUsers(role?: UserRole): Promise<User[]> {
  let sql = baseQuery;
  const params: any[] = [];

  if (role) {
    sql += ' WHERE u.role = ?';
    params.push(role);
  }

  sql += ' ORDER BY u.created_at DESC';

  const users = await queryMany<UserDb>(sql, params);
  return users.map(mapUser);
}

export async function getUserById(id: number): Promise<User | undefined> {
  const sql = baseQuery + ' WHERE u.id = ?';
  const user = await queryOne<UserDb>(sql, [id]);
  return user ? mapUser(user) : undefined;
}

export async function createUser(
  phone: string,
  name: string,
  role: UserRole,
  companyId?: number,
  status: 'active' | 'inactive' = 'active'
): Promise<User> {
  const existing = await queryOne<UserDb>('SELECT id FROM users WHERE phone = ? AND role = ?', [phone, role]);
  if (existing) {
    throw new Error('该手机号已注册');
  }

  const sql = `
    INSERT INTO users (phone, name, role, company_id, status)
    VALUES (?, ?, ?, ?, ?)
  `;
  const result = await execute(sql, [phone, name, role, companyId || null, status]);

  const user = await getUserById(result.lastInsertRowid as number);
  if (!user) {
    throw new Error('创建用户失败');
  }

  return user;
}

export async function updateUser(
  id: number,
  phone: string,
  name: string,
  role: UserRole,
  companyId?: number,
  status?: 'active' | 'inactive'
): Promise<User> {
  const existing = await queryOne<UserDb>(
    'SELECT id FROM users WHERE phone = ? AND role = ? AND id != ?',
    [phone, role, id]
  );
  if (existing) {
    throw new Error('该手机号已被其他用户使用');
  }

  const sql = `
    UPDATE users 
    SET phone = ?, name = ?, role = ?, company_id = ?, status = COALESCE(?, status)
    WHERE id = ?
  `;
  await execute(sql, [phone, name, role, companyId || null, status || null, id]);

  const user = await getUserById(id);
  if (!user) {
    throw new Error('更新用户失败');
  }

  return user;
}

export async function toggleUserStatus(id: number): Promise<User> {
  const user = await getUserById(id);
  if (!user) {
    throw new Error('用户不存在');
  }

  const newStatus = user.status === 'active' ? 'inactive' : 'active';
  await execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);

  return (await getUserById(id))!;
}

export async function getAllCompanies(): Promise<Company[]> {
  const sql = 'SELECT * FROM companies WHERE status = ? ORDER BY name';
  return await queryMany<Company>(sql, ['active']);
}

export async function createCompany(name: string, code: string): Promise<Company> {
  const existing = await queryOne<Company>(
    'SELECT id FROM companies WHERE name = ? OR code = ?',
    [name, code]
  );
  if (existing) {
    throw new Error('快递公司名称或编码已存在');
  }

  const sql = 'INSERT INTO companies (name, code, status) VALUES (?, ?, ?)';
  const result = await execute(sql, [name, code, 'active']);

  const company = await queryOne<Company>('SELECT * FROM companies WHERE id = ?', [result.lastInsertRowid]);
  if (!company) {
    throw new Error('创建快递公司失败');
  }

  return company;
}
