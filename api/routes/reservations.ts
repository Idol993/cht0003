import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireAdmin, requireResident } from '../middleware/permission';
import {
  createReservation,
  getReservations,
  getReservationById,
  approveReservation,
  rejectReservation,
  cancelReservation,
  completeReservation,
} from '../services/reservationService';
import { getCurrentUser } from '../services/authService';
import { ReservationSize, ReservationStatus } from '../../shared/types';

const router = Router();

router.use(authMiddleware);

router.post('/', requireResident, async (req: AuthRequest, res) => {
  try {
    const { itemName, itemDescription, size, itemSize, expectedDate } = req.body;
    const itemNameToUse = itemName || itemDescription;
    const sizeToUse = size || itemSize;
    
    if (!itemNameToUse || !sizeToUse || !expectedDate) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的预约信息',
      });
    }

    if (!['medium', 'large', 'xlarge'].includes(sizeToUse)) {
      return res.status(400).json({
        success: false,
        message: '无效的物品尺寸',
      });
    }

    const user = await getCurrentUser(req.user!.id);
    const reservation = await createReservation(
      user.id,
      itemNameToUse,
      sizeToUse as ReservationSize,
      expectedDate
    );

    res.json({
      success: true,
      data: reservation,
      message: '预约提交成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    const { status } = req.query;
    
    const reservations = await getReservations(
      user.role,
      user.id,
      status as ReservationStatus | undefined
    );

    res.json({
      success: true,
      data: reservations,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const reservation = await getReservationById(parseInt(id));
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: '预约不存在',
      });
    }

    const user = await getCurrentUser(req.user!.id);
    if (user.role === 'resident' && reservation.residentId !== user.id) {
      return res.status(403).json({
        success: false,
        message: '无权查看此预约',
      });
    }

    res.json({
      success: true,
      data: reservation,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id/approve', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { lockerId } = req.body;
    
    const reservation = await approveReservation(
      parseInt(id),
      lockerId ? parseInt(lockerId) : undefined
    );

    res.json({
      success: true,
      data: reservation,
      message: '预约已通过',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id/reject', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const reservation = await rejectReservation(parseInt(id), reason);

    res.json({
      success: true,
      data: reservation,
      message: '预约已拒绝',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id/complete', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const reservation = await completeReservation(parseInt(id));

    res.json({
      success: true,
      data: reservation,
      message: '预约已完成',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUser(req.user!.id);
    
    const reservation = await cancelReservation(parseInt(id), user.id, user.role);

    res.json({
      success: true,
      data: reservation,
      message: '预约已取消',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
