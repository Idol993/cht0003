import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireCourierOrAdmin, requireAdmin, requireResident } from '../middleware/permission';
import {
  createPackage,
  batchImportPackages,
  getPackages,
  getPackageById,
  verifyPickup,
  markAsReturned,
  getPackageOperationLogs,
  getReturnList,
  processReturnBatch,
  claimPackage,
} from '../services/packageService';
import { getDeliveriesByPackageId } from '../services/notificationService';
import { PackageCreateRequest, PackageBatchImportRequest, PickupVerifyRequest, PackageStatus, PackageReturnQueryParams, ReturnProcessRequest } from '../../shared/types';
import { getCurrentUser } from '../services/authService';

const router = Router();

router.use(authMiddleware);

router.post('/', requireCourierOrAdmin, async (req: AuthRequest, res) => {
  try {
    const body = req.body as PackageCreateRequest;
    const trackingNumberToUse = body.trackingNumber || body.trackingNo;
    
    if (!trackingNumberToUse || !body.phoneSuffix) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的包裹信息',
      });
    }

    const user = await getCurrentUser(req.user!.id);
    if (user.role === 'admin' && !body.companyId) {
      return res.status(400).json({
        success: false,
        message: '管理员入库需指定快递公司',
      });
    }

    const pkg = await createPackage(body, user.id);

    res.json({
      success: true,
      data: pkg,
      message: '包裹入库成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/batch', requireCourierOrAdmin, async (req: AuthRequest, res) => {
  try {
    const body = req.body as PackageBatchImportRequest;
    
    if (!body.items || body.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请上传要入库的包裹数据',
      });
    }

    const user = await getCurrentUser(req.user!.id);
    if (user.role === 'admin' && !body.companyId) {
      return res.status(400).json({
        success: false,
        message: '管理员批量入库需指定快递公司',
      });
    }

    const result = await batchImportPackages(body, user.id);

    res.json({
      success: true,
      data: result,
      message: `批量入库完成：成功${result.success}条，失败${result.failed}条`,
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
    
    const { status, phoneSuffix, companyId, dateFrom, dateTo } = req.query;
    
    const filters = {
      status: status as PackageStatus | undefined,
      phoneSuffix: phoneSuffix as string | undefined,
      companyId: companyId ? parseInt(companyId as string) : undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    };

    const packages = await getPackages(
      user.role,
      user.id,
      user.companyId,
      user.phone,
      filters
    );

    res.json({
      success: true,
      data: packages,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/returns', requireCourierOrAdmin, async (req: AuthRequest, res) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    
    const { companyId, minOverdueDays, maxOverdueDays, zone } = req.query;
    
    const params: PackageReturnQueryParams = {
      companyId: companyId ? parseInt(companyId as string) : undefined,
      minOverdueDays: minOverdueDays !== undefined ? parseInt(minOverdueDays as string) : undefined,
      maxOverdueDays: maxOverdueDays !== undefined ? parseInt(maxOverdueDays as string) : undefined,
      zone: zone as string | undefined,
    };

    const packages = await getReturnList(params, user.role, user.companyId);

    res.json({
      success: true,
      data: packages,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/return/batch', requireCourierOrAdmin, async (req: AuthRequest, res) => {
  try {
    const user = await getCurrentUser(req.user!.id);
    const body = req.body as ReturnProcessRequest;
    
    if (!body.packageIds || body.packageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要退回的包裹',
      });
    }

    const result = await processReturnBatch(body.packageIds, user.id, user.name, body.remark);

    res.json({
      success: true,
      data: result,
      message: `批量退回完成：成功${result.success}条，失败${result.failed}条`,
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
    const pkg = await getPackageById(parseInt(id));

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: '包裹不存在',
      });
    }

    const user = await getCurrentUser(req.user!.id);
    
    if (user.role === 'resident') {
      const phoneSuffix = user.phone.slice(-4);
      if (pkg.phoneSuffix !== phoneSuffix && pkg.residentId !== user.id) {
        return res.status(403).json({
          success: false,
          message: '无权查看此包裹',
        });
      }
    } else if (user.role === 'courier') {
      if (pkg.companyId !== user.companyId || pkg.courierId !== user.id) {
        return res.status(403).json({
          success: false,
          message: '无权查看此包裹',
        });
      }
    }

    res.json({
      success: true,
      data: pkg,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/:id/deliveries', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const packageId = parseInt(id);
    
    const user = await getCurrentUser(req.user!.id);
    const pkg = await getPackageById(packageId);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: '包裹不存在',
      });
    }

    if (user.role === 'resident') {
      const phoneSuffix = user.phone.slice(-4);
      if (pkg.phoneSuffix !== phoneSuffix && pkg.residentId !== user.id) {
        return res.status(403).json({
          success: false,
          message: '无权查看此包裹的投递记录',
        });
      }
    } else if (user.role === 'courier') {
      if (pkg.companyId !== user.companyId || pkg.courierId !== user.id) {
        return res.status(403).json({
          success: false,
          message: '无权查看此包裹的投递记录',
        });
      }
    }

    const deliveries = await getDeliveriesByPackageId(packageId);

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

router.put('/:id/pickup', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUser(req.user!.id);
    
    const body = req.body as PickupVerifyRequest;
    let pkg;
    
    if (body.pickupCode) {
      pkg = await verifyPickup(body.pickupCode, user.id, user.name);
    } else {
      pkg = await getPackageById(parseInt(id));
      if (!pkg) {
        return res.status(404).json({
          success: false,
          message: '包裹不存在',
        });
      }
      pkg = await verifyPickup(pkg.pickupCode, user.id, user.name);
    }

    res.json({
      success: true,
      data: pkg,
      message: '取件成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/pickup/verify', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { pickupCode } = req.body as PickupVerifyRequest;
    
    if (!pickupCode) {
      return res.status(400).json({
        success: false,
        message: '请输入取件码',
      });
    }

    const user = await getCurrentUser(req.user!.id);
    const pkg = await verifyPickup(pickupCode, user.id, user.name);

    res.json({
      success: true,
      data: pkg,
      message: '取件成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id/return', requireCourierOrAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUser(req.user!.id);
    const { remark } = req.body as { remark?: string };
    
    const pkg = await getPackageById(parseInt(id));
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: '包裹不存在',
      });
    }

    if (user.role === 'courier' && pkg.companyId !== user.companyId) {
      return res.status(403).json({
        success: false,
        message: '只能退回本公司的包裹',
      });
    }

    const updatedPkg = await markAsReturned(parseInt(id), user.id, user.name, remark);

    res.json({
      success: true,
      data: updatedPkg,
      message: '包裹已标记为退回',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put('/:id/claim', requireResident, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUser(req.user!.id);
    
    const pkg = await getPackageById(parseInt(id));
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: '包裹不存在',
      });
    }

    if (pkg.deliveryStatus !== 'conflict') {
      return res.status(400).json({
        success: false,
        message: '该包裹无需认领',
      });
    }

    const phoneSuffix = user.phone.slice(-4);
    if (pkg.phoneSuffix !== phoneSuffix) {
      return res.status(403).json({
        success: false,
        message: '您无权认领此包裹',
      });
    }

    const updatedPkg = await claimPackage(parseInt(id), user.id);

    res.json({
      success: true,
      data: updatedPkg,
      message: '包裹认领成功',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/:id/trace', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const logs = await getPackageOperationLogs(parseInt(id));

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
