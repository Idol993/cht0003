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
  ReturnReason,
  PrecheckResult,
  ReturnNotificationStatus,
  ReturnStatsQuery,
  ReturnStatsSummary,
  ReturnStatsByCompany,
  ReturnStatsByDate,
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
  return_reason?: string;
  return_evidence?: string;
  return_remark?: string;
  returned_by?: number;
  returned_at?: string;
  return_notification_sent?: number;
  returned_by_name?: string;
}

const MIN_RETURN_DAYS = 7;

function getReturnDays(storedAtStr: string): number {
  const storedAt = new Date(storedAtStr).getTime();
  const now = Date.now();
  const diffHours = (now - storedAt) / (1000 * 60 * 60);
  return Math.floor(diffHours / 24);
}

function isPackageEligibleForReturn(dbPkg: PackageDb): { eligible: boolean; reason?: string; days: number; returnNotificationSent: boolean } {
  const days = getReturnDays(dbPkg.stored_at);
  const pkgStatus = dbPkg.status as string;
  const returnNotificationSent = !!dbPkg.return_notification_sent;

  if (pkgStatus === 'expired') {
    return { eligible: true, days, returnNotificationSent };
  }

  if (pkgStatus === 'pending' && days >= MIN_RETURN_DAYS) {
    return { eligible: true, days, returnNotificationSent };
  }

  if (pkgStatus !== 'pending' && pkgStatus !== 'expired') {
    return { eligible: false, reason: `包裹状态为${dbPkg.status}，不允许退回`, days, returnNotificationSent };
  }

  const remainingDays = MIN_RETURN_DAYS - days;
  return { eligible: false, reason: `存放仅${days}天，未满${MIN_RETURN_DAYS}天（还需${remainingDays}天），暂不可退回`, days, returnNotificationSent };
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
    returnReason: dbPkg.return_reason,
    returnEvidence: dbPkg.return_evidence,
    returnRemark: dbPkg.return_remark,
    returnedBy: dbPkg.returned_by,
    returnedByName: dbPkg.returned_by_name,
    returnedAt: dbPkg.returned_at,
    returnNotificationSent: !!dbPkg.return_notification_sent,
  };
}

const baseQuery = `
  SELECT 
    p.*,
    c.name as company_name,
    l.code as locker_code,
    l.zone as locker_zone,
    u.name as courier_name,
    u2.name as returned_by_name
  FROM packages p
  LEFT JOIN companies c ON p.company_id = c.id
  LEFT JOIN lockers l ON p.locker_id = l.id
  LEFT JOIN users u ON p.courier_id = u.id
  LEFT JOIN users u2 ON p.returned_by = u2.id
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
    (p.status = ? AND CAST(julianday('now') - julianday(p.stored_at) AS INTEGER) >= ?) 
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

  if (params.maxOverdueDays !== undefined) {
    whereConditions.push("CAST(julianday('now') - julianday(p.stored_at) AS INTEGER) >= ?");
    whereConditions.push("CAST(julianday('now') - julianday(p.stored_at) AS INTEGER) <= ?");
    sqlParams.push(minDays, params.maxOverdueDays);
  } else {
    whereConditions.push("CAST(julianday('now') - julianday(p.stored_at) AS INTEGER) >= ?");
    sqlParams.push(minDays);
  }

  if (params.returnNotificationStatus) {
    if (params.returnNotificationStatus === 'not_sent') {
      whereConditions.push('(p.return_notification_sent = 0 OR p.return_notification_sent IS NULL)');
    } else if (params.returnNotificationStatus === 'sent') {
      whereConditions.push('p.return_notification_sent = 1');
    }
  }

  if (params.trackingNo) {
    whereConditions.push('p.tracking_no LIKE ?');
    sqlParams.push('%' + params.trackingNo + '%');
  }

  sql += ' WHERE ' + whereConditions.join(' AND ');
  sql += ' ORDER BY p.stored_at ASC LIMIT 500';

  const packages = await queryMany<PackageDb>(sql, sqlParams);
  return packages.map(mapPackage);
}

export async function markAsReturned(packageId: number, operatorId: number, operatorName: string, operatorRole: UserRole, operatorCompanyId?: number, remark?: string, reason?: ReturnReason, evidence?: string): Promise<Package> {
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
      `UPDATE packages SET 
        status = ?,
        return_reason = ?,
        return_evidence = ?,
        return_remark = ?,
        returned_by = ?,
        returned_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      ['returned', reason || null, evidence || null, remark || null, operatorId, packageId]
    );

    await execute(
      'UPDATE lockers SET current_package_id = NULL, status = ? WHERE id = ?',
      ['available', dbPkg.locker_id]
    );

    const logParts: string[] = [];
    if (reason) {
      logParts.push(`原因:${reason}`);
    }
    if (remark) {
      logParts.push(`备注:${remark}`);
    }
    const logRemark = logParts.length > 0 ? logParts.join(' | ') : '包裹已退回';
    const logDetail = { reason, evidence, remark };
    await addOperationLog(packageId, 'return', operatorId, operatorName, logRemark, logDetail);
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
  remark?: string,
  reason?: ReturnReason,
  evidence?: string
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
        remark,
        reason,
        evidence
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
  remark?: string,
  detail?: any
): Promise<void> {
  const sql = `
    INSERT INTO operation_logs (package_id, action, operator_id, operator_name, remark, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const detailStr = detail ? JSON.stringify(detail) : null;
  await execute(sql, [packageId, action, operatorId || null, operatorName || null, remark || '', detailStr]);
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

export async function precheckReturn(
  packageIds: number[],
  operatorRole: UserRole,
  operatorCompanyId?: number
): Promise<PrecheckResult> {
  const uniqueIds = [...new Set(packageIds)];
  const result: PrecheckResult = {
    total: uniqueIds.length,
    eligibleCount: 0,
    ineligibleCount: 0,
    eligible: [],
    ineligible: [],
  };

  for (const id of uniqueIds) {
    try {
      const sql = baseQuery + ' WHERE p.id = ?';
      const dbPkg = await queryOne<PackageDb>(sql, [id]);

      if (!dbPkg) {
        result.ineligibleCount++;
        result.ineligible.push({ id, error: '包裹不存在' });
        continue;
      }

      if (operatorRole === 'courier' && operatorCompanyId !== undefined) {
        if (dbPkg.company_id !== operatorCompanyId) {
          result.ineligibleCount++;
          result.ineligible.push({
            id,
            trackingNumber: dbPkg.tracking_no,
            error: `不属于您所在的快递公司`,
          });
          continue;
        }
      }

      const eligibility = isPackageEligibleForReturn(dbPkg);
      if (!eligibility.eligible) {
        result.ineligibleCount++;
        result.ineligible.push({
          id,
          trackingNumber: dbPkg.tracking_no,
          error: eligibility.reason || '不符合退回条件',
        });
        continue;
      }

      result.eligibleCount++;
      result.eligible.push({
        id: dbPkg.id,
        trackingNumber: dbPkg.tracking_no,
        companyName: dbPkg.company_name,
        overdueDays: eligibility.days,
        lockerZone: dbPkg.locker_zone,
        lockerCode: dbPkg.locker_code,
      });
    } catch (error: any) {
      result.ineligibleCount++;
      result.ineligible.push({
        id,
        error: error.message || '检查失败',
      });
    }
  }

  return result;
}

export async function precheckReturnPackages(
  packageIds: number[],
  operatorRole: UserRole,
  operatorCompanyId?: number
): Promise<PrecheckResult> {
  return precheckReturn(packageIds, operatorRole, operatorCompanyId);
}

function buildReturnStatsWhere(
  query: ReturnStatsQuery,
  role: UserRole,
  userCompanyId?: number,
  dateField: string = 'stored_at'
): { conditions: string[]; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  if (role === 'courier' && userCompanyId) {
    conditions.push('p.company_id = ?');
    params.push(userCompanyId);
  } else if (query.companyId) {
    conditions.push('p.company_id = ?');
    params.push(query.companyId);
  }

  if (query.startDate) {
    conditions.push(`DATE(p.${dateField}) >= ?`);
    params.push(query.startDate);
  }
  if (query.endDate) {
    conditions.push(`DATE(p.${dateField}) <= ?`);
    params.push(query.endDate);
  }

  return { conditions, params };
}

export async function getReturnStatsSummary(
  query: ReturnStatsQuery,
  role: UserRole,
  userCompanyId?: number
): Promise<ReturnStatsSummary> {
  const pendingConditions: string[] = ['1=1'];
  const pendingParams: any[] = [];

  if (role === 'courier' && userCompanyId) {
    pendingConditions.push('p.company_id = ?');
    pendingParams.push(userCompanyId);
  } else if (query.companyId) {
    pendingConditions.push('p.company_id = ?');
    pendingParams.push(query.companyId);
  }

  pendingConditions.push("p.status IN ('pending', 'expired')");
  pendingConditions.push(`CAST(julianday('now') - julianday(p.stored_at) AS INTEGER) >= ${MIN_RETURN_DAYS}`);

  const pendingWhere = ' WHERE ' + pendingConditions.join(' AND ');

  const pendingSql = `
    SELECT COUNT(*) as cnt FROM packages p
    ${pendingWhere}
  `;
  const pendingResult = await queryOne<{ cnt: number }>(pendingSql, pendingParams);
  const totalPending = pendingResult?.cnt || 0;

  const { conditions: returnedConditions, params: returnedParams } = buildReturnStatsWhere(query, role, userCompanyId, 'returned_at');
  returnedConditions.push("p.status = 'returned'");
  const returnedWhere = ' WHERE ' + returnedConditions.join(' AND ');

  const returnedSql = `
    SELECT COUNT(*) as cnt FROM packages p
    ${returnedWhere}
  `;
  const returnedResult = await queryOne<{ cnt: number }>(returnedSql, returnedParams);
  const totalReturned = returnedResult?.cnt || 0;

  const logConditions: string[] = ["action = 'return'"];
  const logParams: any[] = [];

  if (query.startDate) {
    logConditions.push("DATE(created_at) >= ?");
    logParams.push(query.startDate);
  }
  if (query.endDate) {
    logConditions.push("DATE(created_at) <= ?");
    logParams.push(query.endDate);
  }

  const logWhere = ' WHERE ' + logConditions.join(' AND ');

  const batchTotalSql = `
    SELECT COUNT(*) as cnt FROM operation_logs
    ${logWhere}
  `;
  const batchTotalResult = await queryOne<{ cnt: number }>(batchTotalSql, logParams);
  const batchTotal = batchTotalResult?.cnt || 0;

  const batchSuccess = totalReturned;
  const batchSuccessRate = batchTotal > 0 ? Math.round((batchSuccess / batchTotal) * 100) : 0;

  const reasonConditions = [...returnedConditions, "p.return_reason IS NOT NULL"];
  const reasonWhere = ' WHERE ' + reasonConditions.join(' AND ');
  const reasonsSql = `
    SELECT p.return_reason as reason, COUNT(*) as cnt
    FROM packages p
    ${reasonWhere}
    GROUP BY p.return_reason
    ORDER BY cnt DESC
    LIMIT 10
  `;
  const reasonsResult = await queryMany<{ reason: string; cnt: number }>(reasonsSql, returnedParams);
  const commonFailReasons = reasonsResult.map(r => ({ reason: r.reason, count: r.cnt }));

  return {
    totalPending,
    totalReturned,
    batchTotal,
    batchSuccess,
    batchSuccessRate,
    commonFailReasons,
  };
}

export async function getReturnStatsByCompany(
  query: ReturnStatsQuery,
  role: UserRole,
  userCompanyId?: number
): Promise<ReturnStatsByCompany[]> {
  const companyConditions: string[] = [];
  const companyParams: any[] = [];

  if (role === 'courier' && userCompanyId) {
    companyConditions.push('c.id = ?');
    companyParams.push(userCompanyId);
  } else if (query.companyId) {
    companyConditions.push('c.id = ?');
    companyParams.push(query.companyId);
  }

  const companyAnd = companyConditions.length > 0 ? ' AND ' + companyConditions.join(' AND ') : '';

  const returnedConditions: string[] = ["p.status = 'returned'"];
  const returnedParams: any[] = [];

  if (role === 'courier' && userCompanyId) {
    returnedConditions.push('p.company_id = ?');
    returnedParams.push(userCompanyId);
  } else if (query.companyId) {
    returnedConditions.push('p.company_id = ?');
    returnedParams.push(query.companyId);
  }

  if (query.startDate) {
    returnedConditions.push("DATE(p.returned_at) >= ?");
    returnedParams.push(query.startDate);
  }
  if (query.endDate) {
    returnedConditions.push("DATE(p.returned_at) <= ?");
    returnedParams.push(query.endDate);
  }

  const returnedAnd = returnedConditions.length > 0 ? ' AND ' + returnedConditions.join(' AND ') : '';

  const sql = `
    SELECT 
      c.id as company_id,
      c.name as company_name,
      SUM(CASE WHEN p.status IN ('pending', 'expired') AND CAST(julianday('now') - julianday(p.stored_at) AS INTEGER) >= ${MIN_RETURN_DAYS} THEN 1 ELSE 0 END) as pending,
      (SELECT COUNT(*) FROM packages p2 WHERE p2.company_id = c.id ${returnedAnd}) as returned
    FROM companies c
    LEFT JOIN packages p ON p.company_id = c.id
    WHERE 1=1 ${companyAnd}
    GROUP BY c.id, c.name
    ORDER BY returned DESC, pending DESC
  `;

  const params = [...companyParams, ...returnedParams];
  const rows = await queryMany<{ company_id: number; company_name: string; pending: number; returned: number }>(sql, params);
  return rows.map(r => {
    const total = r.pending + r.returned;
    const successRate = total > 0 ? Math.round((r.returned / total) * 100) : 0;
    return {
      companyId: r.company_id,
      companyName: r.company_name,
      pending: r.pending,
      returned: r.returned,
      successRate,
    };
  });
}

export async function getReturnStatsByDate(
  query: ReturnStatsQuery,
  role: UserRole,
  userCompanyId?: number
): Promise<ReturnStatsByDate[]> {
  const conditions: string[] = ["p.status = 'returned'"];
  const params: any[] = [];

  if (role === 'courier' && userCompanyId) {
    conditions.push('p.company_id = ?');
    params.push(userCompanyId);
  } else if (query.companyId) {
    conditions.push('p.company_id = ?');
    params.push(query.companyId);
  }

  conditions.push("DATE(p.returned_at) >= DATE('now', '-14 days')");

  if (query.startDate) {
    conditions.push("DATE(p.returned_at) >= ?");
    params.push(query.startDate);
  }
  if (query.endDate) {
    conditions.push("DATE(p.returned_at) <= ?");
    params.push(query.endDate);
  }

  const whereSql = ' WHERE ' + conditions.join(' AND ');

  const sql = `
    SELECT 
      DATE(p.returned_at) as date,
      0 as pending,
      COUNT(*) as returned
    FROM packages p
    ${whereSql}
    GROUP BY DATE(p.returned_at)
    ORDER BY date DESC
    LIMIT 14
  `;

  const rows = await queryMany<{ date: string; pending: number; returned: number }>(sql, params);
  return rows.map(r => ({
    date: r.date,
    pending: r.pending,
    returned: r.returned,
  }));
}
