import { queryOne, queryMany, execute, executeTransaction } from '../db';
import {
  Package,
  PackageCreateRequest,
  PackageBatchImportRequest,
  PackageBatchImportResponse,
  PackageStatus,
  UserRole,
  OperationLog,
  PackageReturnQueryParams,
  ReturnProcessRequest,
} from '../../shared/types';
import { generateUniquePickupCode, validatePickupCode } from './pickupCodeService';
import { getAvailableLocker, updateLockerStatus } from './lockerService';
import { createNotification, findResidentUserByPhoneSuffix, sendPickupNotification, sendClaimPickupNotification } from './notificationService';
import { getCurrentUser } from './authService';

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
  delivery_status: string;
  conflict_count: number;
  matched_user_ids?: string;
  company_name: string;
  locker_code: string;
  locker_zone: string;
  courier_name: string;
}

const MIN_RETURN_DAYS = 7;

function getReturnDays(storedAtStr: string): number {
  const storedAt = new Date(storedAtStr).getTime();
  const now = Date.now();
  const diffHours = (now - storedAt) / (1000 * 60 * 60);
  return Math.floor(diffHours / 24);
}

function isPackageEligibleForReturn(dbPkg: PackageDb): { eligible: boolean; reason?: string; days: number } {
  const days = getReturnDays(dbPkg.stored_at);
  const pkgStatus = dbPkg.status as string;

  if (pkgStatus === 'expired') {
    return { eligible: true, days };
  }

  if (pkgStatus === 'pending' && days >= MIN_RETURN_DAYS) {
    return { eligible: true, days };
  }

  if (pkgStatus !== 'pending' && pkgStatus !== 'expired') {
    return { eligible: false, reason: `包裹状态为${dbPkg.status}，不允许退回`, days };
  }

  const remainingDays = MIN_RETURN_DAYS - days;
  return { eligible: false, reason: `存放仅${days}天，未满${MIN_RETURN_DAYS}天（还需${remainingDays}天），暂不可退回`, days };
}

function mapPackage(dbPkg: PackageDb): Package {
  const storedAt = new Date(dbPkg.stored_at);
  const now = new Date();
  const storageHours = Math.floor((now.getTime() - storedAt.getTime()) / (1000 * 60 * 60));
  const isOverdue = storageHours > 48 && dbPkg.status === 'pending';
  const returnDays = getReturnDays(dbPkg.stored_at);
  const overdueDays = Math.max(0, returnDays);

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
    deliveryStatus: dbPkg.delivery_status as any,
    conflictCount: dbPkg.conflict_count || 0,
    matchedUserIds: dbPkg.matched_user_ids ? dbPkg.matched_user_ids.split(',').map(Number) : undefined,
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
  operatorId: number
): Promise<Package> {
  const operator = await getCurrentUser(operatorId);
  const { trackingNumber, trackingNo, phoneSuffix } = req;
  const trackingNumberToUse = trackingNumber || trackingNo;

  let finalCompanyId: number;
  if (operator.role === 'courier') {
    if (!operator.companyId) {
      throw new Error('快递员未绑定公司，无法入库');
    }
    finalCompanyId = operator.companyId;
  } else {
    finalCompanyId = req.companyId;
  }

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
        locker_id, courier_id, status, delivery_status, conflict_count
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', 0)
    `;
    const result = await execute(insertSql, [
      trackingNumberToUse,
      pickupCode,
      phoneSuffix,
      finalCompanyId,
      locker.id,
      operatorId,
    ]);

    packageId = result.lastInsertRowid as number;

    await updateLockerStatus(locker.id, 'occupied', packageId);

    await addOperationLog(packageId, 'store', operatorId, operator.name, '快递入库');

    await sendPickupNotification(packageId);
  });

  return (await getPackageById(packageId!))!;
}

export async function batchImportPackages(
  req: PackageBatchImportRequest,
  operatorId: number
): Promise<PackageBatchImportResponse> {
  const operator = await getCurrentUser(operatorId);
  const success: Package[] = [];
  const errors: string[] = [];
  const failures: { trackingNumber: string; error: string }[] = [];

  let finalCompanyId: number;
  if (operator.role === 'courier') {
    if (!operator.companyId) {
      throw new Error('快递员未绑定公司，无法批量入库');
    }
    finalCompanyId = operator.companyId;
  } else {
    finalCompanyId = req.companyId;
  }

  for (let i = 0; i < req.items.length; i++) {
    const item = req.items[i];
    try {
      const pkg = await createPackage(
        {
          trackingNumber: item.trackingNo,
          trackingNo: item.trackingNo,
          phoneSuffix: item.phoneSuffix,
          companyId: finalCompanyId,
        },
        operatorId
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

    const residentUser = await findResidentUserByPhoneSuffix(pkg.phone_suffix);
    if (residentUser) {
      await createNotification({
        userId: residentUser.id,
        type: 'system',
        title: '包裹已取件',
        content: `运单${pkg.tracking_no}已被取件，格口${pkg.locker_code}已释放`,
        packageId: pkg.id,
      });
    } else {
      await addOperationLog(pkg.id, 'pickup', operatorId, operatorName, '未找到匹配居民用户，跳过取件通知');
    }
  });

  const updatedPkg = await getPackageById(pkg.id);
  if (!updatedPkg) {
    throw new Error('取件操作失败');
  }

  return updatedPkg;
}

export async function getReturnList(
  params: PackageReturnQueryParams = {},
  userRole?: UserRole,
  userCompanyId?: number
): Promise<Package[]> {
  let sql = baseQuery;
  const whereConditions: string[] = [];
  const sqlParams: any[] = [];

  whereConditions.push(`(
    (p.status = ? AND julianday('now') - julianday(p.stored_at) >= ?) 
    OR p.status = ?
  )`);
  sqlParams.push('pending', MIN_RETURN_DAYS, 'expired');

  if (userRole === 'courier' && userCompanyId) {
    whereConditions.push('p.company_id = ?');
    sqlParams.push(userCompanyId);
  }

  if (params.companyId) {
    whereConditions.push('p.company_id = ?');
    sqlParams.push(params.companyId);
  }

  if (params.zone) {
    whereConditions.push('l.zone = ?');
    sqlParams.push(params.zone);
  }

  const minDays = params.minOverdueDays !== undefined 
    ? Math.max(params.minOverdueDays, MIN_RETURN_DAYS) 
    : MIN_RETURN_DAYS;
  whereConditions.push("julianday('now') - julianday(p.stored_at) >= ?");
  sqlParams.push(minDays);

  if (params.maxOverdueDays !== undefined) {
    whereConditions.push("julianday('now') - julianday(p.stored_at) <= ?");
    sqlParams.push(params.maxOverdueDays);
  }

  sql += ' WHERE ' + whereConditions.join(' AND ');
  sql += ' ORDER BY p.stored_at ASC LIMIT 500';

  const packages = await queryMany<PackageDb>(sql, sqlParams);
  return packages.map(mapPackage);
}

export async function markAsReturned(packageId: number, operatorId: number, operatorName: string, operatorRole: UserRole, operatorCompanyId?: number, remark?: string): Promise<Package> {
  const sql = baseQuery + ' WHERE p.id = ?';
  const dbPkg = await queryOne<PackageDb>(sql, [packageId]);
  if (!dbPkg) {
    throw new Error('包裹不存在');
  }

  const eligibility = isPackageEligibleForReturn(dbPkg);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || '包裹不符合退回条件');
  }

  if (operatorRole === 'courier' && operatorCompanyId !== undefined) {
    if (dbPkg.company_id !== operatorCompanyId) {
      throw new Error(`不属于您所在的快递公司，无法退回。本公司ID: ${operatorCompanyId}，包裹公司ID: ${dbPkg.company_id}`);
    }
  }

  let updatedPkg: Package | undefined;

  await executeTransaction(async () => {
    await execute(
      'UPDATE packages SET status = ? WHERE id = ?',
      ['returned', packageId]
    );

    await execute(
      'UPDATE lockers SET current_package_id = NULL, status = ? WHERE id = ?',
      ['available', dbPkg.locker_id]
    );

    const logRemark = remark || '包裹已退回';
    await addOperationLog(packageId, 'return', operatorId, operatorName, logRemark);
  });

  updatedPkg = await getPackageById(packageId);
  if (!updatedPkg) {
    throw new Error('退回操作失败');
  }

  return updatedPkg;
}

export interface BatchReturnResult {
  success: number;
  failed: number;
  errors: string[];
  successItems: { id: number; trackingNumber: string }[];
  failedItems: { id: number; trackingNumber?: string; error: string }[];
}

export async function processReturnBatch(
  packageIds: number[],
  operatorId: number,
  operatorName: string,
  operatorRole: UserRole,
  operatorCompanyId?: number,
  remark?: string
): Promise<BatchReturnResult> {
  const uniqueIds = [...new Set(packageIds)];
  
  const result: BatchReturnResult = {
    success: 0,
    failed: 0,
    errors: [],
    successItems: [],
    failedItems: [],
  };

  for (const packageId of uniqueIds) {
    let trackingNumber: string | undefined;
    
    try {
      const dbPkg = await queryOne<{ id: number; tracking_no: string }>(
        'SELECT id, tracking_no FROM packages WHERE id = ?',
        [packageId]
      );
      trackingNumber = dbPkg?.tracking_no;

      const pkg = await markAsReturned(
        packageId,
        operatorId,
        operatorName,
        operatorRole,
        operatorCompanyId,
        remark
      );
      
      result.success++;
      result.successItems.push({ id: packageId, trackingNumber: pkg.trackingNumber });
    } catch (error: any) {
      const errorMsg = error.message || '未知错误';
      result.failed++;
      result.errors.push(`包裹ID ${packageId}${trackingNumber ? `（运单：${trackingNumber}）` : ''}：${errorMsg}`);
      result.failedItems.push({ id: packageId, trackingNumber, error: errorMsg });
    }
  }

  return result;
}

export async function claimPackage(packageId: number, userId: number): Promise<Package> {
  const sql = baseQuery + ' WHERE p.id = ?';
  const dbPkg = await queryOne<PackageDb>(sql, [packageId]);

  if (!dbPkg) {
    throw new Error('包裹不存在');
  }

  if (dbPkg.delivery_status !== 'conflict') {
    throw new Error('该包裹无需认领');
  }

  const matchedUserIds = dbPkg.matched_user_ids ? dbPkg.matched_user_ids.split(',').map(Number) : [];
  if (!matchedUserIds.includes(userId)) {
    throw new Error('您无权认领此包裹');
  }

  await executeTransaction(async () => {
    await execute(
      'UPDATE packages SET delivery_status = ?, resident_id = ? WHERE id = ?',
      ['claimed', userId, packageId]
    );

    await sendClaimPickupNotification(packageId, userId);
  });

  const updatedPkg = await getPackageById(packageId);
  if (!updatedPkg) {
    throw new Error('认领操作失败');
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
