import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/permission';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getAllDeliveries,
} from '../services/notificationService';
import { getCurrentUser } from '../services/authService';
import { NotificationType, DeliveryQueryParams, NotificationQueryParams } from '../../shared/types';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    const { limit, type, unreadOnly } = req.query;
    
    const params: NotificationQueryParams = {
      limit: limit ? parseInt(limit as string) : 50,
      type: type as NotificationType | undefined,
      unreadOnly: unreadOnly === 'true',
    };

    const notifications = await getUserNotifications(user.id, params);

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/deliveries', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { packageId, notificationType, status, startDate, endDate } = req.query;
    
    const params: DeliveryQueryParams = {
      packageId: packageId ? parseInt(packageId as string) : undefined,
      notificationType: notificationType as NotificationType | undefined,
      status: status as any,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    };

    const deliveries = await getAllDeliveries(params);

    res.json({
      success: true,
      data: deliveries,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    const count = await getUnreadCount(user.id);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id/read', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUser(req.user!.id);
    
    await markAsRead(parseInt(id), user.id);

    res.json({
      success: true,
      message: '已标记为已读',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/read-all', async (req: AuthRequest, res) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    await markAllAsRead(user.id);

    res.json({
      success: true,
      message: '已全部标记为已读',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
