export type UserRole = 'resident' | 'courier' | 'admin';

export type PackageStatus = 'pending' | 'picked' | 'returned' | 'expired';

export type LockerSize = 'small' | 'medium' | 'large';

export type LockerStatus = 'available' | 'occupied' | 'maintenance';

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export type ReservationSize = 'medium' | 'large' | 'xlarge';

export type NotificationType = 'pickup' | 'reminder' | 'return' | 'reservation' | 'system';

export type OperationAction = 'store' | 'pickup' | 'reminder' | 'return' | 'expire';

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
  read: boolean;
  createdAt: string;
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
