export type UserRole = 'resident' | 'courier' | 'admin';

export type PackageStatus = 'pending' | 'picked' | 'returned' | 'expired';

export type LockerSize = 'small' | 'medium' | 'large';

export type LockerStatus = 'available' | 'occupied' | 'maintenance';

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export type ReservationSize = 'medium' | 'large' | 'xlarge';

export type NotificationType = 'pickup' | 'reminder' | 'return' | 'reservation' | 'system' | 'claim';

export type OperationAction = 'store' | 'pickup' | 'reminder' | 'return' | 'expire' | 'return_precheck' | 'claim' | 'return_notify';

export type DeliveryStatus = 'pending' | 'delivered' | 'conflict' | 'claimed';

export type DeliveryStatusType = 'success' | 'blocked_conflict' | 'no_match' | 'failed';

export interface User {
  id: number;
  phone: string;
  name: string;
  role: UserRole;
  companyId?: number;
  companyName?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Company {
  id: number;
  name: string;
  code: string;
  status: string;
}

export interface Locker {
  id: number;
  code: string;
  zone: string;
  size: LockerSize;
  status: LockerStatus;
  currentPackageId?: number;
}

export interface Package {
  id: number;
  trackingNumber: string;
  trackingNo?: string;
  pickupCode: string;
  phoneSuffix: string;
  fullPhone?: string;
  companyId: number;
  companyName: string;
  lockerId: number;
  lockerCode: string;
  lockerZone: string;
  status: PackageStatus;
  size?: LockerSize;
  courierId: number;
  courierName: string;
  residentId?: number;
  storedAt: string;
  pickedAt?: string;
  createdAt: string;
  storageHours: number;
  isOverdue: boolean;
  overdueDays: number;
  deliveryStatus: DeliveryStatus;
  conflictCount: number;
  matchedUserIds?: number[];
  returnReason?: string;
  returnEvidence?: string;
  returnRemark?: string;
  returnedBy?: number;
  returnedByName?: string;
  returnedAt?: string;
  returnNotificationSent: boolean;
}

export interface Reservation {
  id: number;
  residentId: number;
  residentName: string;
  residentPhone: string;
  itemName: string;
  phone: string;
  size: ReservationSize;
  remark?: string;
  rejectReason?: string;
  expectedDate: string;
  status: ReservationStatus;
  lockerId?: number;
  lockerCode?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  packageId?: number;
  deliveryId?: number;
  read: boolean;
  createdAt: string;
}

export interface NotificationDelivery {
  id: number;
  packageId: number;
  trackingNumber?: string;
  notificationType: NotificationType;
  status: DeliveryStatusType;
  recipientUserId?: number;
  recipientPhone?: string;
  recipientName?: string;
  matchedCount: number;
  matchedUserIds?: number[];
  sentAt: string;
  remark?: string;
  package?: Package;
}

export interface OperationLog {
  id: number;
  packageId: number;
  action: OperationAction;
  operation?: OperationAction;
  operatorId?: number;
  operatorName?: string;
  remark: string;
  createdAt: string;
}

export interface StatisticsSummary {
  todayStored: number;
  todayPicked: number;
  pendingCount: number;
  pickupRate: number;
  expiredCount: number;
  overdueCount: number;
  pickedCount: number;
  todayInbound: number;
  todayOutbound: number;
  totalInbound: number;
  totalOutbound: number;
}

export interface TrendData {
  date: string;
  storedCount: number;
  pickedCount: number;
}

export interface CompanyStats {
  companyId: number;
  companyName: string;
  storedCount: number;
  pickedCount: number;
  returnedCount: number;
  inboundCount: number;
  outboundCount: number;
  pendingCount: number;
}

export interface LoginRequest {
  phone: string;
  code: string;
  role?: UserRole;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface PackageCreateRequest {
  trackingNumber: string;
  trackingNo?: string;
  phoneSuffix: string;
  companyId: number;
  size?: LockerSize;
}

export interface PackageBatchImportRequest {
  trackingNumbers: string[];
  items?: {
    trackingNo: string;
    phoneSuffix: string;
  }[];
  companyId: number;
}

export interface PickupVerifyRequest {
  pickupCode: string;
}

export interface NotificationQueryParams {
  type?: NotificationType;
  unreadOnly?: boolean;
  limit?: number;
}

export interface DeliveryQueryParams {
  packageId?: number;
  notificationType?: NotificationType;
  status?: DeliveryStatusType;
  startDate?: string;
  endDate?: string;
}

export interface PackageReturnQueryParams {
  companyId?: number;
  minOverdueDays?: number;
  maxOverdueDays?: number;
  zone?: string;
  status?: PackageStatus;
}

export interface BatchReturnResult {
  success: number;
  failed: number;
  errors: string[];
  successItems: { id: number; trackingNumber: string }[];
  failedItems: { id: number; trackingNumber?: string; error: string }[];
}

export type ReturnReason =
  | 'user_request'
  | 'expired_7d'
  | 'address_error'
  | 'damaged'
  | 'refused_by_recipient'
  | 'other';

export const RETURN_REASON_OPTIONS: { value: ReturnReason; label: string }[] = [
  { value: 'user_request', label: '收件人要求退回' },
  { value: 'expired_7d', label: '存放满7天未取件' },
  { value: 'address_error', label: '地址/联系方式错误' },
  { value: 'damaged', label: '包裹破损' },
  { value: 'refused_by_recipient', label: '收件人拒收' },
  { value: 'other', label: '其他原因' },
];

export interface ReturnProcessRequest {
  packageIds: number[];
  reason?: ReturnReason;
  evidence?: string;
  remark?: string;
}

export interface PrecheckResult {
  total: number;
  eligibleCount: number;
  ineligibleCount: number;
  eligible: { id: number; trackingNumber: string; companyName: string; overdueDays: number; lockerZone: string; lockerCode: string }[];
  ineligible: { id: number; trackingNumber?: string; error: string }[];
}

export type ReturnNotificationStatus = 'not_sent' | 'sent' | 'all';

export interface ReturnStatsQuery {
  startDate?: string;
  endDate?: string;
  companyId?: number;
}

export interface ReturnStatsSummary {
  totalPending: number;
  totalReturned: number;
  batchTotal: number;
  batchSuccess: number;
  batchSuccessRate: number;
  commonFailReasons: { reason: string; count: number }[];
}

export interface ReturnStatsByCompany {
  companyId: number;
  companyName: string;
  pending: number;
  returned: number;
  successRate: number;
}

export interface ReturnStatsByDate {
  date: string;
  pending: number;
  returned: number;
}

export interface PackageReturnQueryParams {
  companyId?: number;
  minOverdueDays?: number;
  maxOverdueDays?: number;
  zone?: string;
  status?: PackageStatus;
  returnNotificationStatus?: ReturnNotificationStatus;
  trackingNo?: string;
}

export interface ReservationCreateRequest {
  residentId?: number;
  itemName: string;
  phone: string;
  size: ReservationSize;
  remark?: string;
  expectedDate: string;
}

export interface PackageBatchImportResponse {
  success: number;
  failed: number;
  errors: string[];
  packages: Package[];
  totalCount: number;
  successCount: number;
  failCount: number;
  failures: { trackingNumber: string; error: string }[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: number;
}
