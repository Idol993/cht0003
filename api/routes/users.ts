import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/permission';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  getAllCompanies,
  createCompany,
} from '../services/userService';
import { UserRole } from '../../shared/types';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    const users = await getAllUsers(role as UserRole | undefined);
    res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/companies', async (req, res) => {
  try {
    const companies = await getAllCompanies();
    res.json({
      success: true,
      data: companies,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserById(parseInt(id));
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

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

router.post('/', async (req, res) => {
  try {
    const { phone, name, role, companyId, status } = req.body;
    
    if (!phone || !name || !role) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的用户信息',
      });
    }

    if (!['resident', 'courier', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户角色',
      });
    }

    if (role === 'courier' && !companyId) {
      return res.status(400).json({
        success: false,
        message: '快递员必须绑定快递公司',
      });
    }

    const user = await createUser(
      phone,
      name,
      role as UserRole,
      companyId ? parseInt(companyId) : undefined,
      status || 'active'
    );

    res.json({
      success: true,
      data: user,
      message: '用户创建成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/companies', async (req, res) => {
  try {
    const { name, code } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的快递公司信息',
      });
    }

    const company = await createCompany(name, code);
    res.json({
      success: true,
      data: company,
      message: '快递公司创建成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, name, role, companyId, status } = req.body;
    
    if (!phone || !name || !role) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的用户信息',
      });
    }

    if (!['resident', 'courier', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户角色',
      });
    }

    const user = await updateUser(
      parseInt(id),
      phone,
      name,
      role as UserRole,
      companyId ? parseInt(companyId) : undefined,
      status as 'active' | 'inactive' | undefined
    );

    res.json({
      success: true,
      data: user,
      message: '用户更新成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await toggleUserStatus(parseInt(id));
    
    res.json({
      success: true,
      data: user,
      message: `用户已${user.status === 'active' ? '启用' : '禁用'}`,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
