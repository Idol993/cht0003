import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/permission';
import {
  getAllLockers,
  getLockerById,
  createLocker,
  updateLocker,
  getLockerStats,
} from '../services/lockerService';
import { LockerSize, LockerStatus } from '../../shared/types';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const lockers = await getAllLockers();
    res.json({
      success: true,
      data: lockers,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await getLockerStats();
    res.json({
      success: true,
      data: stats,
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
    const locker = await getLockerById(parseInt(id));
    
    if (!locker) {
      return res.status(404).json({
        success: false,
        message: '格口不存在',
      });
    }

    res.json({
      success: true,
      data: locker,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { code, zone, size } = req.body;
    
    if (!code || !zone || !size) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的格口信息',
      });
    }

    if (!['small', 'medium', 'large'].includes(size)) {
      return res.status(400).json({
        success: false,
        message: '无效的格口尺寸',
      });
    }

    const locker = await createLocker(code, zone, size as LockerSize);
    
    res.json({
      success: true,
      data: locker,
      message: '格口创建成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, zone, size, status } = req.body;
    
    if (!code || !zone || !size || !status) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的格口信息',
      });
    }

    if (!['small', 'medium', 'large'].includes(size)) {
      return res.status(400).json({
        success: false,
        message: '无效的格口尺寸',
      });
    }

    if (!['available', 'occupied', 'maintenance'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的格口状态',
      });
    }

    const locker = await updateLocker(
      parseInt(id),
      code,
      zone,
      size as LockerSize,
      status as LockerStatus
    );
    
    res.json({
      success: true,
      data: locker,
      message: '格口更新成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
