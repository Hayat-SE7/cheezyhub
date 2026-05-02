import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

// ─── Silent refresh helper ─────────────────────────────
// On 401, attempts to rotate the refresh token and retry the original request.
// Falls back to redirect if refresh fails.

interface PanelConfig {
  tokenCookie:   string;
  refreshCookie: string;
  loginPath:     string;
}

const refreshQueues = new Map<string, Promise<string | null>>();

async function attemptRefresh(panel: PanelConfig): Promise<string | null> {
  const refreshToken = Cookies.get(panel.refreshCookie);
  if (!refreshToken) return null;

  // Deduplicate concurrent refresh calls for the same panel
  const inflight = refreshQueues.get(panel.tokenCookie);
  if (inflight) return inflight;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Refresh timeout')), 15_000)
  );

  const promise = Promise.race([
    axios
      .post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken })
      .then((res) => {
        const { token, refreshToken: newRefresh } = res.data.data;
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
        Cookies.set(panel.tokenCookie, token, { expires: 1, sameSite: 'lax', path: '/', secure });
        Cookies.set(panel.refreshCookie, newRefresh, { expires: 7, sameSite: 'lax', path: '/', secure });
        return token as string;
      }),
    timeout,
  ])
    .catch(() => null)
    .finally(() => { refreshQueues.delete(panel.tokenCookie); });

  refreshQueues.set(panel.tokenCookie, promise);
  return promise;
}

function setupInterceptors(instance: AxiosInstance, panel: PanelConfig, skipAuthEndpoints = false) {
  instance.interceptors.request.use((config) => {
    const token = Cookies.get(panel.tokenCookie);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const originalRequest = err.config as InternalAxiosRequestConfig & { _retried?: boolean };

      if (err.response?.status === 401 && !originalRequest._retried) {
        // Skip refresh for auth endpoints (login forms handle their own 401s)
        if (skipAuthEndpoints) {
          const url = originalRequest.url ?? '';
          if (url.includes('/auth/login') || url.includes('/auth/send-otp') ||
              url.includes('/auth/verify-otp') || url.includes('/auth/register')) {
            return Promise.reject(err);
          }
        }

        originalRequest._retried = true;
        const newToken = await attemptRefresh(panel);
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return instance(originalRequest);
        }

        // Refresh failed — clear cookies and redirect
        Cookies.remove(panel.tokenCookie, { path: '/' });
        Cookies.remove(panel.refreshCookie, { path: '/' });
        if (typeof window !== 'undefined') window.location.href = panel.loginPath;
      }
      return Promise.reject(err);
    }
  );
}

// ─── Customer (default) instance ────────────────────────
const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL, timeout: 15000 });
setupInterceptors(api, { tokenCookie: 'ch_token', refreshCookie: 'ch_refresh', loginPath: '/customer/login' }, true);

export { api };
export default api;

// ─── Delivery panel ─────────────────────────────────────
const deliveryApi_http = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL, timeout: 15000 });
setupInterceptors(deliveryApi_http, { tokenCookie: 'ch_delivery_token', refreshCookie: 'ch_delivery_refresh', loginPath: '/delivery/login' });

// ─── Kitchen panel ──────────────────────────────────────
const kitchenApi_http = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL, timeout: 15000 });
setupInterceptors(kitchenApi_http, { tokenCookie: 'ch_kitchen_token', refreshCookie: 'ch_kitchen_refresh', loginPath: '/kitchen/login' });

// ─── Admin panel ────────────────────────────────────────
const adminApi_http = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL, timeout: 15000 });
setupInterceptors(adminApi_http, { tokenCookie: 'ch_admin_token', refreshCookie: 'ch_admin_refresh', loginPath: '/admin/login' });

// ─── Counter panel ──────────────────────────────────────
const counterApi_http = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL, timeout: 15000 });
setupInterceptors(counterApi_http, { tokenCookie: 'ch_counter_token', refreshCookie: 'ch_counter_refresh', loginPath: '/counter/login' });


// ─── Typed helpers ────────────────────────────

export const authApi = {
  // Staff + existing customer login
  login: (data: { identifier: string; pin: string; role?: 'customer' | 'staff' }) =>
    api.post('/auth/login', data),

  // OTP registration flow (v6.1)
  sendOtp:    (mobile: string)                                          =>
    api.post('/auth/send-otp', { mobile }),
  verifyOtp:  (mobile: string, otp: string)                            =>
    api.post('/auth/verify-otp', { mobile, otp }),
  completeRegistration: (data: { verificationToken: string; name: string; pin: string }) =>
    api.post('/auth/complete-registration', data),
  resetPin: (data: { verificationToken: string; pin: string }) =>
    api.post('/auth/reset-pin', data),
  register: (data: any) => api.post('/auth/register', data),
};

export const menuApi = {
  // Public — customer panel, no auth required
  getPublic: ()                      => api.get('/menu'),
  // Admin — full list
  getAll:    ()                      => adminApi_http.get('/menu/all'),
  // Single item (for editing)
  getItem:   (id: string)            => adminApi_http.get(`/menu/items/${id}`),
  // Item CRUD
  createItem: (data: any)            => adminApi_http.post('/menu/items', data),
  updateItem: (id: string, data: any)=> adminApi_http.patch(`/menu/items/${id}`, data),
  deleteItem: (id: string)           => adminApi_http.delete(`/menu/items/${id}`),
  // Category CRUD
  getCategories: ()                  => adminApi_http.get('/menu/categories'),
  createCategory:(data: { name: string; sortOrder?: number }) =>
    adminApi_http.post('/menu/categories', data),
  updateCategory:(id: string, data: { name?: string; sortOrder?: number }) =>
    adminApi_http.patch(`/menu/categories/${id}`, data),
  deleteCategory:(id: string)        => adminApi_http.delete(`/menu/categories/${id}`),
  // Availability toggles (admin — kitchen uses kitchenApi which has its own kitchenApi_http)
  setItemAvailability:    (id: string, isAvailable: boolean) =>
    adminApi_http.patch(`/menu/items/${id}/availability`, { isAvailable }),
  setModifierAvailability:(id: string, isAvailable: boolean) =>
    adminApi_http.patch(`/menu/modifiers/${id}/availability`, { isAvailable }),
};

// TODO: backend endpoints not yet implemented
export const orderApi = {
  create: (data: any) => api.post('/orders', data),
  getMyOrders: () => api.get('/orders'),
  getOrder: (id: string) => api.get(`/orders/${id}`),
};

// --- Merged Address API (v6.1) ---
export const addressApi = {
  getAll:     ()                          => api.get('/addresses'),
  create:     (data: any)                 => api.post('/addresses', data),
  update:     (id: string, data: any)     => api.patch(`/addresses/${id}`, data),
  remove:     (id: string)                => api.delete(`/addresses/${id}`),
  setDefault: (id: string)                => api.patch(`/addresses/${id}/default`),
  saveGps:    (data: { latitude: number; longitude: number; addressText: string }) =>
    api.post('/addresses/gps', data),
};

export const paymentApi = {
  // Safepay integration endpoint
  create: (orderId: string, paymentMethod: 'cash' | 'safepay') =>
    api.post('/payments/create', { orderId, paymentMethod }),
  getStatus: (orderId: string) => api.get(`/payments/status/${orderId}`),
  // Dev only — confirm a stub payment without going through Safepay
  stubConfirm: (orderId: string) => api.post('/payments/stub-confirm', { orderId }),
};

export const publicSettingsApi = {
  // Returns deliveryFee, serviceCharge, restaurantName, ordersAccepting
  getFees: () => api.get('/menu/settings/public'),
};

export const kitchenApi = {
  getQueue: () => kitchenApi_http.get('/kitchen/orders'),
  getHistory: () => kitchenApi_http.get('/kitchen/orders/history'),
  setStatus: (id: string, status: string) =>
    kitchenApi_http.patch(`/kitchen/orders/${id}/status`, { status }),
  // Inventory control
  setItemAvailability: (id: string, isAvailable: boolean) =>
    kitchenApi_http.patch(`/kitchen/inventory/items/${id}`, { isAvailable }),
  setModifierAvailability: (id: string, isAvailable: boolean) =>
    kitchenApi_http.patch(`/kitchen/inventory/modifiers/${id}`, { isAvailable }),
  pauseOrders: (paused: boolean) => kitchenApi_http.patch('/kitchen/pause', { paused }),
};

export const deliveryApi = {
  // Auth (uses main api — login returns ch_delivery_token)
  login: (data: { identifier: string; pin: string }) =>
    api.post('/auth/login', { ...data, role: 'staff' }),

  // Status toggle
  setDriverStatus: (status: 'AVAILABLE' | 'OFFLINE') =>
    deliveryApi_http.patch('/delivery/status', { status }),

  // Orders
  getMyOrders:  ()                        => deliveryApi_http.get('/delivery/orders'),
  getHistory:   (page = 1)                => deliveryApi_http.get('/delivery/orders/history', { params: { page } }),
  setStatus:    (id: string, status: string) =>
    deliveryApi_http.patch(`/delivery/orders/${id}/status`, { status }),
  getMapsUrl:   (id: string)              => deliveryApi_http.get(`/delivery/orders/${id}/maps`),

  // Profile & verification
  getProfile:   ()                        => deliveryApi_http.get('/delivery/profile'),
  updateProfile:(data: Record<string, any>) =>
    deliveryApi_http.patch('/delivery/profile', data),
  uploadDocument: (file: File, field: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('field', field);
    return deliveryApi_http.post('/delivery/upload-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Live location
  updateLocation: (lat: number, lng: number) =>
    deliveryApi_http.patch('/delivery/location', { lat, lng }),

  // COD wallet
  getCOD:       ()                        => deliveryApi_http.get('/delivery/cod'),
  getSettlements:()                       => deliveryApi_http.get('/delivery/settlements'),

  // Earnings
  getEarnings:  ()                        => deliveryApi_http.get('/delivery/earnings'),

  // Holidays
  getHolidays:  ()                        => deliveryApi_http.get('/delivery/holidays'),
  requestHoliday:(data: { fromDate: string; toDate: string; reason: string }) =>
    deliveryApi_http.post('/delivery/holidays', data),
  cancelHoliday:(id: string)             => deliveryApi_http.patch(`/delivery/holidays/${id}`, {}),
};

export const adminApi = {
  // Dashboard
  getStats: () => adminApi_http.get('/admin/stats'),
  // Orders
  getOrders: (params?: Record<string, any>) => adminApi_http.get('/admin/orders', { params }),
  assignDriver: (orderId: string, driverId: string) =>
    adminApi_http.patch(`/admin/orders/${orderId}/assign`, { driverId }),
  cancelOrder: (orderId: string) => adminApi_http.patch(`/admin/orders/${orderId}/cancel`),
  // Staff
  getStaff: () => adminApi_http.get('/admin/staff'),
  getStaffMember: (id: string) => adminApi_http.get(`/admin/staff/${id}`),
  createStaff: (data: { username: string; pin: string; role: string }) =>
    adminApi_http.post('/admin/staff', data),
  updateStaff: (id: string, data: { isActive?: boolean; pin?: string }) =>
    adminApi_http.patch(`/admin/staff/${id}`, data),
  resetStaffPin: (id: string, newPin: string) => adminApi_http.post(`/admin/staff/${id}/reset-pin`, { newPin }),
  deleteStaff: (id: string) => adminApi_http.delete(`/admin/staff/${id}`),
  // Drivers for assignment dropdown
  getDrivers: () => adminApi_http.get('/admin/drivers'),
  // Settings
  getSettings: () => adminApi_http.get('/admin/settings'),
  updateSettings: (data: Record<string, any>) => adminApi_http.patch('/admin/settings', data),
  // Notification log + retry
  getNotifications: () => adminApi_http.get('/admin/notifications'),
  retryNotification: (id: string) => adminApi_http.post(`/admin/notifications/${id}/retry`),
  // Customers
  getCustomers: (params?: Record<string, any>) => adminApi_http.get('/admin/customers', { params }),
  getCustomer: (id: string) => adminApi_http.get(`/admin/customers/${id}`),
  updateCustomer: (id: string, data: any) => adminApi_http.patch(`/admin/customers/${id}`, data),
  exportCustomer: (id: string) => adminApi_http.get(`/admin/customers/${id}/export`, { responseType: 'blob' }),
};

export const adminDriverApi = {
  getAll: () => adminApi_http.get('/admin/drivers'),
  getOne: (id: string) => adminApi_http.get(`/admin/drivers/${id}`),
  create: (data: any) => adminApi_http.post('/admin/drivers', data),
  update: (id: string, data: any) => adminApi_http.patch(`/admin/drivers/${id}`, data),
  verify: (id: string, data: any) => adminApi_http.patch(`/admin/drivers/${id}/verify`, data),
  manualAssign: (id: string, orderId: string) => adminApi_http.patch(`/admin/drivers/${id}/assign`, { orderId }),
  getHolidays: (status?: string) => adminApi_http.get('/admin/holiday-requests', { params: { status } }),
  reviewHoliday: (id: string, data: any) => adminApi_http.patch(`/admin/holiday-requests/${id}`, data),
  getAllSettlements: (params?: any) => adminApi_http.get('/admin/settlements', { params }),
  settle: (data: any) => adminApi_http.post('/admin/settlements', data),
};

export const ticketApi = {
  // Customer-facing (uses customer auth token)
  create: (data: any) => api.post('/tickets', data),
  getMyTickets: () => api.get('/tickets'),
  getMyTicket: (id: string) => api.get(`/tickets/${id}`),
  replyAsCustomer: (id: string, message: string) => api.post(`/tickets/${id}/reply`, { message }),
  // Admin-facing (uses admin auth token)
  getAll: () => adminApi_http.get('/tickets'),
  get: (id: string) => adminApi_http.get(`/tickets/${id}`),
  reply: (id: string, message: string) => adminApi_http.post(`/tickets/${id}/reply`, { message }),
  setStatus: (id: string, status: string) => adminApi_http.patch(`/tickets/${id}/status`, { status }),
};

export const dealsApi = {
  // Public
  getActive:  ()            => api.get('/deals'),
  getSlider:  ()            => api.get('/deals/slider'),
  // Admin
  getAll:     ()            => adminApi_http.get('/deals/admin'),
  create:     (data: any)   => adminApi_http.post('/deals/admin', data),
  update:     (id: string, data: any) => adminApi_http.patch(`/deals/admin/${id}`, data),
  remove:     (id: string)  => adminApi_http.delete(`/deals/admin/${id}`),
  toggle:     (id: string)  => adminApi_http.patch(`/deals/admin/${id}/toggle`),
};

export const analyticsApi = {
  getDashboard: (range?: string) => adminApi_http.get('/admin/analytics', { params: { range } }),
  exportCsv: (range: string) => adminApi_http.get('/admin/analytics/export', { params: { range }, responseType: 'blob' }),
};
export const favouritesApi = {
  getAll: () => api.get('/favourites'),
  toggle: (menuItemId: string) => api.post('/favourites', { menuItemId }),
};

export const counterApi = {
  // Menu
  getMenu:      ()                          => counterApi_http.get('/counter/menu'),
  // Orders
  placeOrder:   (data: {
    items:         { menuItemId: string; quantity: number; selectedModifierIds: string[]; notes?: string }[];
    customerNote?: string;
    paymentMethod: 'cash' | 'card';
  })                                        => counterApi_http.post('/counter/orders', data),
  getOrders:    ()                          => counterApi_http.get('/counter/orders'),
  // Ledger
  recordPayment:(data: {
    orderId:    string;
    method:     'cash' | 'card' | 'split';
    amount:     number;
    cashAmount?: number;
    cardAmount?: number;
    notes?:     string;
  })                                        => counterApi_http.post('/counter/ledger', data),
  // Shift
  getCurrentShift: ()                       => counterApi_http.get('/counter/shift/current'),
  startShift:   (openingFloat: number)      => counterApi_http.post('/counter/shift/start', { openingFloat }),
  endShift:     (closingCash: number, notes?: string) =>
    counterApi_http.post('/counter/shift/end', { closingCash, notes }),
};
