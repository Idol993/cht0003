import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRole } from '../../shared/types';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未登录',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足，无法执行此操作',
      });
    }

    next();
  };
}

export function requireCourierOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return requireRole('courier', 'admin')(req, res, next);
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  return requireRole('admin')(req, res, next);
}

export function requireResident(req: AuthRequest, res: Response, next: NextFunction) {
  return requireRole('resident')(req, res, next);
}
