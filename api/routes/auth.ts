import { Router } from 'express';
import { login, getCurrentUser, getVerificationCode } from '../services/authService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { UserRole } from '../../shared/types';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { phone, code, role } = req.body;
    
    if (!phone || !code || !role) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的登录信息',
      });
    }

    if (!['resident', 'courier', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户角色',
      });
    }

    const result = await login(phone, code, role as UserRole);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/code', (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: '请输入手机号',
      });
    }

    const code = getVerificationCode(phone);
    
    res.json({
      success: true,
      data: { code: '123456' },
      message: '验证码已发送（演示环境固定为123456）',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未登录',
      });
    }

    const user = await getCurrentUser(req.user.id);
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
