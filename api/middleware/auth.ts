import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../../shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'express-delivery-secret-key-2024';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌',
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      role: decoded.role as UserRole,
      name: decoded.name,
      status: 'active',
      createdAt: '',
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '认证令牌无效或已过期',
    });
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
