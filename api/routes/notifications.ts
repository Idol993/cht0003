import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notificationService';
import { getCurrentUser } from '../services/authService';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    const { limit } = req.query;
    
    const notifications = await getUserNotifications(
      user.id,
      limit ? parseInt(limit as string) : 50
    );

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
