import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/permission';
import {
  getStatisticsSummary,
  getTrendData,
  getCompanyStats,
  getHourlyDistribution,
  getSizeDistribution,
  getZoneDistribution,
} from '../services/statisticsService';
import {
  runOverdueRemindersManually,
  runExpiredNotificationsManually,
} from '../services/cronService';

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/summary', async (req, res) => {
  try {
    const summary = await getStatisticsSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/trend', async (req, res) => {
  try {
    const { days } = req.query;
    const trendData = await getTrendData(days ? parseInt(days as string) : 7);
    res.json({
      success: true,
      data: trendData,
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
    const { dateFrom, dateTo } = req.query;
    const stats = await getCompanyStats(
      dateFrom as string | undefined,
      dateTo as string | undefined
    );
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

router.get('/hourly', async (req, res) => {
  try {
    const data = await getHourlyDistribution();
    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/locker-size', async (req, res) => {
  try {
    const data = await getSizeDistribution();
    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/locker-zone', async (req, res) => {
  try {
    const data = await getZoneDistribution();
    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/run-reminders', async (req, res) => {
  try {
    const count = await runOverdueRemindersManually();
    res.json({
      success: true,
      message: `已发送${count}条超时提醒`,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/run-expired', async (req, res) => {
  try {
    const count = await runExpiredNotificationsManually();
    res.json({
      success: true,
      message: `已发送${count}条退回通知`,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
