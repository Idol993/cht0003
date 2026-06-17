import { ApiResponse, LoginRequest, LoginResponse, User, Package, PackageCreateRequest, PackageBatchImportRequest, PackageBatchImportResponse, PickupVerifyRequest, Locker, Reservation, ReservationCreateRequest, StatisticsSummary, TrendData, Company, CompanyStats, Notification, OperationLog, NotificationDelivery, ReturnProcessRequest, PackageReturnQueryParams, NotificationQueryParams } from '../../shared/types';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || '请求失败');
  }

  return data.data;
}

export const authApi = {
  login: (data: LoginRequest) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendCode: (phone: string) =>
    request<{ code: string }>('/auth/code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  getCurrentUser: () =>
    request<User>('/auth/me'),
};

export const packageApi = {
  create: (data: PackageCreateRequest) =>
    request<Package>('/packages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  batchImport: (data: PackageBatchImportRequest) =>
    request<PackageBatchImportResponse>('/packages/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getList: (params?: {
    status?: string;
    phoneSuffix?: string;
    companyId?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request<Package[]>(`/packages${query}`);
  },

  getById: (id: number) =>
    request<Package>(`/packages/${id}`),

  verifyPickup: (pickupCode: string) =>
    request<Package>('/packages/pickup/verify', {
      method: 'POST',
      body: JSON.stringify({ pickupCode } as PickupVerifyRequest),
    }),

  markAsReturned: (id: number, remark?: string) =>
    request<Package>(`/packages/${id}/return`, {
      method: 'PUT',
      body: JSON.stringify({ remark }),
    }),

  processReturns: (data: ReturnProcessRequest) =>
    request<{ success: number; failed: number; errors: string[] }>('/packages/return/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getReturnList: (params?: PackageReturnQueryParams) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request<Package[]>(`/packages/returns${query}`);
  },

  getTrace: (id: number) =>
    request<OperationLog[]>(`/packages/${id}/trace`),

  getDeliveries: (id: number) =>
    request<NotificationDelivery[]>(`/packages/${id}/deliveries`),

  claimPackage: (id: number) =>
    request<Package>(`/packages/${id}/claim`, {
      method: 'PUT',
    }),
};

export const lockerApi = {
  getList: () =>
    request<Locker[]>('/lockers'),

  getStats: () =>
    request<any>('/lockers/stats'),

  create: (data: { code: string; zone: string; size: string }) =>
    request<Locker>('/lockers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: { code: string; zone: string; size: string; status: string }) =>
    request<Locker>(`/lockers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export const reservationApi = {
  create: (data: ReservationCreateRequest) =>
    request<Reservation>('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getList: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return request<Reservation[]>(`/reservations${query}`);
  },

  approve: (id: number, lockerId?: number) =>
    request<Reservation>(`/reservations/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ lockerId }),
    }),

  reject: (id: number, reason?: string) =>
    request<Reservation>(`/reservations/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),

  cancel: (id: number) =>
    request<Reservation>(`/reservations/${id}/cancel`, {
      method: 'PUT',
    }),

  complete: (id: number) =>
    request<Reservation>(`/reservations/${id}/complete`, {
      method: 'PUT',
    }),
};

export const statisticsApi = {
  getSummary: () =>
    request<StatisticsSummary>('/statistics/summary'),

  getTrend: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return request<TrendData[]>(`/statistics/trend${query}`);
  },

  getCompanyStats: (dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<CompanyStats[]>(`/statistics/companies${query}`);
  },

  getHourlyDistribution: () =>
    request<any[]>('/statistics/hourly'),

  getSizeDistribution: () =>
    request<any[]>('/statistics/locker-size'),

  getZoneDistribution: () =>
    request<any[]>('/statistics/locker-zone'),

  runReminders: () =>
    request<void>('/statistics/run-reminders', { method: 'POST' }),

  runExpired: () =>
    request<void>('/statistics/run-expired', { method: 'POST' }),
};

export const userApi = {
  getList: (role?: string) => {
    const query = role ? `?role=${role}` : '';
    return request<User[]>(`/users${query}`);
  },

  getCompanies: () =>
    request<Company[]>('/users/companies'),

  create: (data: { phone: string; name: string; role: string; companyId?: number; status?: string }) =>
    request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: { phone: string; name: string; role: string; companyId?: number; status?: string }) =>
    request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleStatus: (id: number) =>
    request<User>(`/users/${id}/toggle-status`, {
      method: 'PUT',
    }),

  createCompany: (data: { name: string; code: string }) =>
    request<Company>('/users/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const notificationApi = {
  getList: (params?: NotificationQueryParams) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request<Notification[]>(`/notifications${query}`);
  },

  getUnreadCount: () =>
    request<{ count: number }>('/notifications/unread-count'),

  markAsRead: (id: number) =>
    request<void>(`/notifications/${id}/read`, {
      method: 'PUT',
    }),

  markAllAsRead: () =>
    request<void>('/notifications/read-all', {
      method: 'PUT',
    }),

  getDeliveryLogs: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request<NotificationDelivery[]>(`/notifications/deliveries${query}`);
  },
};
