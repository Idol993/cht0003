import { queryOne, execute } from '../db';
import { User, LoginResponse, UserRole } from '../../shared/types';
import { generateToken, generateVerificationCode } from '../middleware/auth';

interface UserDb {
  id: number;
  phone: string;
  name: string;
  role: UserRole;
  company_id?: number;
  status: string;
  created_at: string;
}

function mapUser(dbUser: UserDb & { company_name?: string }): User {
  return {
    id: dbUser.id,
    phone: dbUser.phone,
    name: dbUser.name,
    role: dbUser.role,
    companyId: dbUser.company_id,
    companyName: dbUser.company_name,
    status: dbUser.status as 'active' | 'inactive',
    createdAt: dbUser.created_at,
  };
}

export async function login(
  phone: string,
  code: string,
  role: UserRole
): Promise<LoginResponse> {
  if (code !== '123456') {
    throw new Error('验证码错误');
  }

  const sql = `
    SELECT u.*, c.name as company_name 
    FROM users u 
    LEFT JOIN companies c ON u.company_id = c.id 
    WHERE u.phone = ? AND u.role = ?
  `;
  
  let user = await queryOne<UserDb & { company_name?: string }>(sql, [phone, role]);

  if (!user) {
    if (role === 'resident') {
      const insertSql = `
        INSERT INTO users (phone, name, role, status)
        VALUES (?, ?, ?, 'active')
      `;
      await execute(insertSql, [phone, `用户${phone.slice(-4)}`, role]);
      
      user = await queryOne<UserDb & { company_name?: string }>(sql, [phone, role]);
      if (!user) {
        throw new Error('用户创建失败');
      }
    } else {
      throw new Error('用户不存在，请联系管理员注册');
    }
  }

  if (user.status !== 'active') {
    throw new Error('账号已被禁用');
  }

  const mappedUser = mapUser(user);
  const token = generateToken(mappedUser);

  return {
    token,
    user: mappedUser,
  };
}

export async function getCurrentUser(userId: number): Promise<User> {
  const sql = `
    SELECT u.*, c.name as company_name 
    FROM users u 
    LEFT JOIN companies c ON u.company_id = c.id 
    WHERE u.id = ?
  `;
  
  const user = await queryOne<UserDb & { company_name?: string }>(sql, [userId]);
  if (!user) {
    throw new Error('用户不存在');
  }
  
  return mapUser(user);
}

export function getVerificationCode(phone: string): string {
  return generateVerificationCode();
}
