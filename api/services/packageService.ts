import { queryOne, queryMany, execute, executeTransaction } from '../db';
import {
  Package,
  PackageCreateRequest,
  PackageBatchImportRequest,
  PackageBatchImportResponse,
  PackageStatus,
  UserRole,
  OperationLog,
} from '../../shared/types';
import { generateUniquePickupCode, validatePickupCode } from './pickupCodeService';
import { getAvailableLocker, updateLockerStatus } from './lockerService';
import { createNotification } from './notificationService';

interface PackageDb {
  id: number;
  tracking_no: string;
  pickup_code: string;
  phone_suffix: string;
  company_id: number;
  locker_id: number;
  status: PackageStatus;
  courier_id: number;
  resident_id?: number;
  stored_at: string;
  picked_at?: string;
  created_at: string;
  company_name: string;
  locker_code: string;
  locker_zone: string;
  courier_name: string;
}

function mapPackage(dbPkg: PackageDb): Package {
  const storedAt = new Date(dbPkg.stored_at);
  const now = new Date();
  const storageHours = Math.floor((now.getTime() - storedAt.getTime()) / (1000 * 60 * 60));
  const isOverdue = storageHours > 48 && dbPkg.status === 'pending';
  const overdueDays = isOverdue ? Math.floor((storageHours - 48) / 24) : 0;

  return {
    id: dbPkg.id,
    trackingNumber: dbPkg.tracking_no,
    trackingNo: dbPkg.tracking_no,
    pickupCode: dbPkg.pickup_code,
    phoneSuffix: dbPkg.phone_suffix,
    companyId: dbPkg.company_id,
    companyName: dbPkg.company_name,
    lockerId: dbPkg.locker_id,
    lockerCode: dbPkg.locker_code,
    lockerZone: dbPkg.locker_zone,
    status: dbPkg.status,
    courierId: dbPkg.courier_id,
    courierName: dbPkg.courier_name,
    residentId: dbPkg.resident_id,
    storedAt: dbPkg.stored_at,
    pickedAt: dbPkg.picked_at,
    createdAt: dbPkg.created_at,
    storageHours,
    isOverdue,
    overdueDays,
  };
}

const baseQuery = `
  SELECT 
    p.*,
    c.name as company_name,
    l.code as locker_code,
    l.zone as locker_zone,
    u.name as courier_name
  FROM packages p
  LEFT JOIN companies c ON p.company_id = c.id
  LEFT JOIN lockers l ON p.locker_id = l.id
  LEFT JOIN users u ON p.courier_id = u.id
`;

export async function createPackage(
  req: PackageCreateRequest,
  courierId: number,
  courierName: string
): Promise<Package> {
  const { trackingNumber, trackingNo, phoneSuffix, companyId } = req;
  const trackingNumberToUse = trackingNumber || trackingNo;

  if (!trackingNumberToUse) {
    throw new Error('运单号不能为空');
  }

  if (!/^\d{4}$/.test(phoneSuffix)) {
    throw new Error('手机尾号必须是4位数字');
  }

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM packages WHERE tracking_no = ? AND status = ?',
    [trackingNumberToUse, 'pending']
  );
  if (existing) {
    throw new Error('该运单号已存在待取件记录');
  }

  const pickupCode = await generateUniquePickupCode();
  const locker = await getAvailableLocker();

  let packageId: number;

  await executeTransaction(async () => {
    const insertSql = `
      INSERT INTO packages (
        tracking_no, pickup_code, phone_suffix, company_id, 
        locker_id, courier_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;
    const result = await execute(insertSql, [
      trackingNumberToUse,
      pickupCode,
      phoneSuffix,
      companyId,
      locker.id,
      courierId,
    ]);

    packageId = result.lastInsertRowid as number;

    await updateLockerStatus(locker.id, 'occupied', packageId);

    await addOperationLog(packageId, 'store', courierId, courierName, '快递入库');

    await createNotification({
      userId: 0,
      type: 'pickup',
      title: '快递已送达',
      content: `您的${await getCompanyName(companyId)}快递已存入${locker.zone}${locker.code}格口，取件码：${pickupCode}`,
      packageId,
      phoneSuffix,
    });
  });

  return (await getPackageById(packageId!))!;
}

export async function batchImportPackages(
  req: PackageBatchImportRequest,
  courierId: number,
  courierName: string
): Promise<PackageBatchImportResponse> {
  const success: Package[] = [];
  const errors: string[] = [];
  const failures: { trackingNumber: string; error: string }[] = [];

  for (let i = 0; i < req.items.length; i++) {
    const item = req.items[i];
    try {
      const pkg = await createPackage(
        {
          trackingNumber: item.trackingNo,
          trackingNo: item.trackingNo,
          phoneSuffix: item.phoneSuffix,
          companyId: req.companyId,
        },
        courierId,
        courierName
      );
      success.push(pkg);
    } catch (error: any) {
      const errorMsg = error.message || '未知错误';
      errors.push(`第${i + 1}行（运单：${item.trackingNo}）：${errorMsg}`);
      failures.push({ trackingNumber: item.trackingNo, error: errorMsg });
    }
  }

  const totalCount = req.items.length;
  const successCount = success.length;
  const failCount = failures.length;

  return {
    success: success.length,
    failed: errors.length,
    errors,
    packages: success,
    totalCount,
    successCount,
    failCount,
    failures,
  };
}

export async function getPackages(
  userRole: UserRole,
  userId: number,
  userCompanyId?: number,
  userPhone?: string,
  filters?: {
    status?: PackageStatus;
    phoneSuffix?: string;
    companyId?: number;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<Package[]> {
  let sql = baseQuery;
  const whereConditions: string[] = [];
  const params: any[] = [];

  if (userRole === 'resident') {
    const phoneSuffix = userPhone?.slice(-4);
    if (phoneSuffix) {
      whereConditions.push(`(p.phone_suffix = ? OR p.resident_id = ?)`);
      params.push(phoneSuffix, userId);
    }
  } else if (userRole === 'courier') {
    if (userCompanyId) {
      whereConditions.push('p.company_id = ?');
      params.push(userCompanyId);
    }
    whereConditions.push('p.courier_id = ?');
    params.push(userId);
  }

  if (filters?.status) {
    whereConditions.push('p.status = ?');
    params.push(filters.status);
  }
  if (filters?.phoneSuffix) {
    whereConditions.push('p.phone_suffix = ?');
    params.push(filters.phoneSuffix);
  }
  if (filters?.companyId) {
    whereConditions.push('p.company_id = ?');
    params.push(filters.companyId);
  }
  if (filters?.dateFrom) {
    whereConditions.push('DATE(p.stored_at) >= ?');
    params.push(filters.dateFrom);
  }
  if (filters?.dateTo) {
    whereConditions.push('DATE(p.stored_at) <= ?');
    params.push(filters.dateTo);
  }

  if (whereConditions.length > 0) {
    sql += ' WHERE ' + whereConditions.join(' AND ');
  }

  sql += ' ORDER BY p.stored_at DESC LIMIT 200';

  const packages = await queryMany<PackageDb>(sql, params);
  return packages.map(mapPackage);
}

export async function getPackageById(id: number): Promise<Package | undefined> {
  const sql = baseQuery + ' WHERE p.id = ?';
  const pkg = await queryOne<PackageDb>(sql, [id]);
  return pkg ? mapPackage(pkg) : undefined;
}

export async function verifyPickup(pickupCode: string, operatorId: number, operatorName: string): Promise<Package> {
  if (!validatePickupCode(pickupCode)) {
    throw new Error('取件码格式不正确');
  }

  const sql = baseQuery + ' WHERE p.pickup_code = ? AND p.status = ?';
  const pkg = await queryOne<PackageDb>(sql, [pickupCode, 'pending']);

  if (!pkg) {
    throw new Error('取件码无效或包裹已被取走');
  }

  await executeTransaction(async () => {
    await execute(
      'UPDATE packages SET status = ?, picked_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['picked', pkg.id]
    );

    await updateLockerStatus(pkg.locker_id, 'available', undefined);

    await addOperationLog(pkg.id, 'pickup', operatorId, operatorName, '包裹已取件');

    await createNotification({
      userId: 0,
      type: 'system',
      title: '包裹已取件',
      content: `运单${pkg.tracking_no}已被取件，格口${pkg.locker_code}已释放`,
      packageId: pkg.id,
    });
  });

  const updatedPkg = await getPackageById(pkg.id);
  if (!updatedPkg) {
    throw new Error('取件操作失败');
  }

  return updatedPkg;
}

export async function markAsReturned(packageId: number, operatorId: number, operatorName: string): Promise<Package> {
  const pkg = await getPackageById(packageId);
  if (!pkg) {
    throw new Error('包裹不存在');
  }
  if (pkg.status !== 'pending') {
    throw new Error('只有待取件的包裹可以退回');
  }

  await executeTransaction(async () => {
    await execute(
      'UPDATE packages SET status = ? WHERE id = ?',
      ['returned', packageId]
    );

    await updateLockerStatus(pkg.lockerId, 'available', undefined);

    await addOperationLog(packageId, 'return', operatorId, operatorName, '包裹已退回');
  });

  const updatedPkg = await getPackageById(packageId);
  if (!updatedPkg) {
    throw new Error('退回操作失败');
  }

  return updatedPkg;
}

export async function addOperationLog(
  packageId: number,
  action: OperationLog['action'],
  operatorId?: number,
  operatorName?: string,
  remark?: string
): Promise<void> {
  const sql = `
    INSERT INTO operation_logs (package_id, action, operator_id, operator_name, remark)
    VALUES (?, ?, ?, ?, ?)
  `;
  await execute(sql, [packageId, action, operatorId || null, operatorName || null, remark || '']);
}

export async function getPackageOperationLogs(packageId: number): Promise<OperationLog[]> {
  const sql = `
    SELECT * FROM operation_logs 
    WHERE package_id = ? 
    ORDER BY created_at DESC
  `;
  return await queryMany<OperationLog>(sql, [packageId]);
}

async function getCompanyName(companyId: number): Promise<string> {
  const result = await queryOne<{ name: string }>(
    'SELECT name FROM companies WHERE id = ?',
    [companyId]
  );
  return result?.name || '快递';
}

export async function getOverduePackages(): Promise<Package[]> {
  const sql = baseQuery + `
    WHERE p.status = 'pending' 
    AND julianday('now') - julianday(p.stored_at) > 2
    ORDER BY p.stored_at ASC
  `;
  const packages = await queryMany<PackageDb>(sql);
  return packages.map(mapPackage);
}

export async function getExpiredPackages(): Promise<Package[]> {
  const sql = baseQuery + `
    WHERE p.status = 'pending' 
    AND julianday('now') - julianday(p.stored_at) > 7
    ORDER BY p.stored_at ASC
  `;
  const packages = await queryMany<PackageDb>(sql);
  return packages.map(mapPackage);
}
