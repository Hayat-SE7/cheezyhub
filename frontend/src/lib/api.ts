import axios from 'axios';
import Cookies from 'js-cookie';

// ─────────────────────────────────────────────────────────────────
//  api.ts  — CheezyHub  (Complete)
//  Each panel has its own isolated axios instance + cookie.
// ─────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL;

function makeInstance(cookie: string, redirect: string, timeout = 15000) {
  const inst = axios.create({ baseURL: BASE, timeout });

  inst.interceptors.request.use((cfg) => {
    const token = Cookies.get(cookie);
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });

  inst.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        Cookies.remove(cookie);
        if (typeof window !== 'undefined') window.location.href = redirect;
      }
      return Promise.reject(err);
    }
  );
  return inst;
}

// Panel-isolated instances
const _api      = makeInstance('ch_token',          '/customer/login');
const _counter  = makeInstance('ch_counter_token',  '/counter/login', 20000);
const _kitchen  = makeInstance('ch_kitchen_token',  '/kitchen/login');
const _delivery = makeInstance('ch_delivery_token', '/delivery/login');
const _admin    = makeInstance('ch_admin_token',    '/admin/login');

export default _api;
export { _api as api };

// ─────────────────────────────────────────────────────────────────
//  AUTH API
// ─────────────────────────────────────────────────────────────────
export const authApi = {
  // Staff + customer login
  login:     (data: { identifier: string; pin: string; role?: 'customer' | 'staff' }) =>
    _api.post('/auth/login', data),

  // OTP flow (customer self-registration)
  sendOtp:   (mobile: string)                              => _api.post('/auth/send-otp', { mobile }),
  verifyOtp: (mobile: string, otp: string)                 => _api.post('/auth/verify-otp', { mobile, otp }),
  completeRegistration: (data: { verificationToken: string; name: string; pin: string }) =>
    _api.post('/auth/complete-registration', data),
  register: (data: { name: string; mobile?: string; email?: string; pin: string }) =>
    _api.post('/auth/register', data),

  // Direct PIN login / reset
  loginPin:  (mobile: string, pin: string)                 => _api.post('/auth/login-pin', { mobile, pin }),
  resetPin:  (data: { identifier: string; newPin: string }) => _api.post('/auth/reset-pin', data),

  me: () => _api.get('/auth/me'),
};

// ─────────────────────────────────────────────────────────────────
//  COUNTER API  (POS panel — ch_counter_token)
// ─────────────────────────────────────────────────────────────────
export const counterApi = {
  getMenu:   () => _counter.get('/counter/menu'),
  getOrders: () => _counter.get('/counter/orders'),

  placeOrder: (data: {
    items:             { menuItemId: string; quantity: number; selectedModifierIds: string[]; notes?: string }[];
    customerNote?:     string;
    paymentMethod:     'cash' | 'card';
    offlineSync?:      boolean;
    offlineCreatedAt?: string;
  }) => _counter.post('/counter/orders', data),

  recordPayment: (data: {
    orderId:     string;
    method:      'cash' | 'card' | 'split';
    amount:      number;
    cashAmount?: number;
    cardAmount?: number;
    notes?:      string;
  }) => _counter.post('/counter/ledger', data),

  getCurrentShift: ()                                    => _counter.get('/counter/shift/current'),
  startShift:      (openingFloat: number)                => _counter.post('/counter/shift/start', { openingFloat }),
  endShift:        (closingCash: number, notes?: string) => _counter.post('/counter/shift/end', { closingCash, notes }),

  syncQueue: (orders: {
    idempotencyKey:  string;
    createdAt:       string;
    type:            string;
    endpoint:        string;
    method:          string;
    body:            unknown;
  }[]) => _counter.post('/counter/sync', { orders }),

  invalidateMenuCache: () => _counter.post('/counter/menu/invalidate'),
  getMe:               () => _counter.get('/auth/me'),
};

// ─────────────────────────────────────────────────────────────────
//  KITCHEN API  (ch_kitchen_token)
// ─────────────────────────────────────────────────────────────────
export const kitchenApi = {
  getOrders:    ()                                => _kitchen.get('/kitchen/orders'),
  setStatus:    (orderId: string, status: string) => _kitchen.patch(`/kitchen/orders/${orderId}/status`, { status }),
  updateStatus: (orderId: string, status: string) => _kitchen.patch(`/kitchen/orders/${orderId}/status`, { status }),
  pauseOrders:  (paused: boolean)                 => _kitchen.patch('/kitchen/pause', { paused }),
  getQueue:     ()                                => _kitchen.get('/kitchen/orders'),
  getSSEUrl:    ()                                => `${BASE}/kitchen/sse`,
  getMe:        ()                                => _kitchen.get('/auth/me'),
};

// ─────────────────────────────────────────────────────────────────
//  DELIVERY API  (ch_delivery_token)
// ─────────────────────────────────────────────────────────────────
export const deliveryApi = {
  getAssigned:    ()                                => _delivery.get('/delivery/orders'),
  getMyOrders:    ()                                => _delivery.get('/delivery/orders'),
  updateStatus:   (orderId: string, status: string) => _delivery.patch(`/delivery/orders/${orderId}/status`, { status }),
  setStatus:      (orderId: string, status: string) => _delivery.patch(`/delivery/orders/${orderId}/status`, { status }),
  updateLocation: (lat: number, lng: number)        => _delivery.post('/delivery/location', { lat, lng }),
  toggleStatus:   (status: string)                  => _delivery.patch('/delivery/status', { status }),
  getMapsUrl:     (orderId: string)                 => _delivery.get(`/delivery/orders/${orderId}/maps`),

  // COD wallet
  getCod: () => _delivery.get('/delivery/cod'),
  getCOD: () => _delivery.get('/delivery/cod'),

  getEarnings:    ()              => _delivery.get('/delivery/earnings'),
  getHistory:     (page = 1)      => _delivery.get('/delivery/history', { params: { page } }),
  getSettlements: ()              => _delivery.get('/delivery/settlements'),

  getHolidays:    ()              => _delivery.get('/delivery/holidays'),
  requestHoliday: (data: { fromDate: string; toDate: string; reason?: string }) =>
    _delivery.post('/delivery/holidays', data),
  cancelHoliday:  (id: string)   => _delivery.patch(`/delivery/holidays/${id}/cancel`),

  getProfile:    ()          => _delivery.get('/delivery/profile'),
  updateProfile: (data: any) => _delivery.patch('/delivery/profile', data),

  getSSEUrl: () => `${BASE}/delivery/sse`,
  getMe:      () => _delivery.get('/auth/me'),
};

// ─────────────────────────────────────────────────────────────────
//  ADMIN API  (ch_admin_token)
// ─────────────────────────────────────────────────────────────────
export const adminApi = {
  // Dashboard / analytics
  getDashboard: ()                             => _admin.get('/admin/dashboard'),
  getAnalytics: (params?: Record<string, any>) => _admin.get('/admin/analytics', { params }),
  getStats:     ()                             => _admin.get('/admin/stats'),

  // Orders
  getOrders:         (params?: Record<string, any>)      => _admin.get('/admin/orders', { params }),
  updateOrderStatus: (orderId: string, status: string)   => _admin.patch(`/admin/orders/${orderId}/status`, { status }),
  cancelOrder:       (orderId: string)                   => _admin.patch(`/admin/orders/${orderId}/cancel`),
  assignDriver:      (orderId: string, driverId: string) => _admin.patch(`/admin/orders/${orderId}/assign`, { driverId }),

  // Menu management
  getMenuAll:     ()                      => _admin.get('/admin/menu'),
  createCategory: (data: any)             => _admin.post('/admin/menu/categories', data),
  updateCategory: (id: string, data: any) => _admin.patch(`/admin/menu/categories/${id}`, data),
  deleteCategory: (id: string)            => _admin.delete(`/admin/menu/categories/${id}`),
  createItem:     (data: any)             => _admin.post('/admin/menu/items', data),
  updateItem:     (id: string, data: any) => _admin.patch(`/admin/menu/items/${id}`, data),
  deleteItem:     (id: string)            => _admin.delete(`/admin/menu/items/${id}`),
  invalidateCounterMenuCache: ()          => _admin.post('/counter/menu/invalidate'),

  // Deals
  getDeals:   ()                      => _admin.get('/admin/deals'),
  createDeal: (data: any)             => _admin.post('/admin/deals', data),
  updateDeal: (id: string, data: any) => _admin.patch(`/admin/deals/${id}`, data),
  toggleDeal: (id: string)            => _admin.patch(`/admin/deals/${id}/toggle`),
  deleteDeal: (id: string)            => _admin.delete(`/admin/deals/${id}`),

  // Staff
  getStaff:      ()                           => _admin.get('/admin/staff'),
  getStaffMember:(id: string)                 => _admin.get(`/admin/staff/${id}`),
  createStaff:   (data: any)                  => _admin.post('/admin/staff', data),
  updateStaff:   (id: string, data: any)      => _admin.patch(`/admin/staff/${id}`, data),
  deleteStaff:   (id: string)                 => _admin.delete(`/admin/staff/${id}`),
  resetStaffPin: (id: string, newPin: string) => _admin.post(`/admin/staff/${id}/reset-pin`, { newPin }),

  // Customers
  getCustomers:   (params?: Record<string, any>) => _admin.get('/admin/customers', { params }),
  getCustomer:    (id: string)                    => _admin.get(`/admin/customers/${id}`),
  updateCustomer: (id: string, data: any)         => _admin.patch(`/admin/customers/${id}`, data),
  exportCustomer: (id: string)                    => _admin.get(`/admin/customers/${id}/export`, { responseType: 'blob' }),

  // Drivers
  getDrivers: () => _admin.get('/admin/drivers'),

  // Settings
  getSettings:    ()          => _admin.get('/admin/settings'),
  updateSettings: (data: any) => _admin.patch('/admin/settings', data),

  getSSEUrl: () => `${BASE}/admin/sse`,
  getMe:      () => _admin.get('/auth/me'),

  // Availability aliases used by admin/menu
  setItemAvailability:        (id: string, isAvailable: boolean) => _admin.patch(`/admin/menu/items/${id}/availability`, { isAvailable }),
  setModifierAvailability:    (id: string, isAvailable: boolean) => _admin.patch(`/admin/menu/modifiers/${id}/availability`, { isAvailable }),
};

// ─────────────────────────────────────────────────────────────────
//  ADMIN DRIVER API
// ─────────────────────────────────────────────────────────────────
export const adminDriverApi = {
  getAll:        ()                           => _admin.get('/admin/drivers'),
  getAllDrivers:  ()                           => _admin.get('/admin/drivers'),
  getDriver:     (id: string)                 => _admin.get(`/admin/drivers/${id}`),
  createDriver:  (data: any)                  => _admin.post('/admin/drivers', data),
  updateDriver:  (id: string, data: any)      => _admin.patch(`/admin/drivers/${id}`, data),
  update:        (id: string, data: any)      => _admin.patch(`/admin/drivers/${id}`, data),
  verifyDriver:  (id: string, data: any)      => _admin.patch(`/admin/drivers/${id}/verify`, data),
  verify:        (id: string, data: any)      => _admin.patch(`/admin/drivers/${id}/verify`, data),
  manualAssign:  (driverId: string, orderId: string) => _admin.patch(`/admin/drivers/${driverId}/assign`, { orderId }),
  getOne:        (id: string)                 => _admin.get(`/admin/drivers/${id}`),
  create:        (data: any)                  => _admin.post('/admin/drivers', data),

  getSettlements:    (params?: Record<string, any>) => _admin.get('/admin/settlements', { params }),
  getAllSettlements:  (params?: Record<string, any>) => _admin.get('/admin/settlements', { params }),
  settle:            (data: any)                    => _admin.post('/admin/settlements', data),
  settleDriver:      (data: any)                    => _admin.post('/admin/settlements', data),

  getHolidays:        (status?: string) => _admin.get('/admin/holiday-requests', { params: status ? { status } : undefined }),
  getHolidayRequests: (status?: string) => _admin.get('/admin/holiday-requests', { params: status ? { status } : undefined }),
  reviewHoliday:      (id: string, data: any) => _admin.patch(`/admin/holiday-requests/${id}`, data),
};

// ─────────────────────────────────────────────────────────────────
//  ANALYTICS API
// ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  getDashboard: (range?: string | number) =>
    _admin.get('/admin/analytics', { params: range ? { range } : undefined }),
  exportCsv: (range?: string | number) =>
    _admin.get('/admin/analytics/export', { params: range ? { range } : undefined, responseType: 'blob' }),
};

// ─────────────────────────────────────────────────────────────────
//  MENU API  (public + admin)
// ─────────────────────────────────────────────────────────────────
export const menuApi = {
  getAll:    () => _api.get('/menu'),
  getPublic: () => _api.get('/menu'),
  getSSEUrl: () => `${BASE}/sse`,
  
  // Admin CRUD methods per the contract requirement
  getItem:                    (id: string)            => _admin.get(`/admin/menu/items/${id}`),
  createItem:                 (data: any)             => _admin.post('/admin/menu/items', data),
  updateItem:                 (id: string, data: any) => _admin.patch(`/admin/menu/items/${id}`, data),
  deleteItem:                 (id: string)            => _admin.delete(`/admin/menu/items/${id}`),
  createCategory:             (data: any)             => _admin.post('/admin/menu/categories', data),
  updateCategory:             (id: string, data: any) => _admin.patch(`/admin/menu/categories/${id}`, data),
  deleteCategory:             (id: string)            => _admin.delete(`/admin/menu/categories/${id}`),
  toggleItemAvailability:     (id: string, isAvailable: boolean) => _admin.patch(`/admin/menu/items/${id}/availability`, { isAvailable }),
  setItemAvailability:        (id: string, isAvailable: boolean) => _admin.patch(`/admin/menu/items/${id}/availability`, { isAvailable }),
  toggleModifierAvailability: (id: string, isAvailable: boolean) => _admin.patch(`/admin/menu/modifiers/${id}/availability`, { isAvailable }),
  setModifierAvailability:    (id: string, isAvailable: boolean) => _admin.patch(`/admin/menu/modifiers/${id}/availability`, { isAvailable }),
};

// ─────────────────────────────────────────────────────────────────
//  DEALS API
// ─────────────────────────────────────────────────────────────────
export const dealsApi = {
  getAll:    () => _api.get('/deals'),
  getActive: () => _api.get('/deals'),
  create:    (data: any)             => _admin.post('/admin/deals', data),
  update:    (id: string, data: any) => _admin.patch(`/admin/deals/${id}`, data),
  toggle:    (id: string)            => _admin.patch(`/admin/deals/${id}/toggle`),
  remove:    (id: string)            => _admin.delete(`/admin/deals/${id}`),
};

// ─────────────────────────────────────────────────────────────────
//  ORDER API  (customer-facing)
// ─────────────────────────────────────────────────────────────────
export const orderApi = {
  create:      (data: any)  => _api.post('/orders', data),
  place:       (data: any)  => _api.post('/orders', data),
  getMyOrders: ()           => _api.get('/orders'),
  getById:     (id: string) => _api.get(`/orders/${id}`),
};

// ─────────────────────────────────────────────────────────────────
//  TICKET API
// ─────────────────────────────────────────────────────────────────
export const ticketApi = {
  getAll:   ()                            => _api.get('/tickets'),
  create:   (data: any)                   => _api.post('/tickets', data),
  get:      (id: string)                  => _api.get(`/tickets/${id}`),
  getById:  (id: string)                  => _api.get(`/tickets/${id}`),
  reply:    (id: string, message: string) => _api.post(`/tickets/${id}/messages`, { message }),
  setStatus:(id: string, status: string)  => _api.patch(`/tickets/${id}/status`, { status }),
};

// ─────────────────────────────────────────────────────────────────
//  ADDRESS API
// ─────────────────────────────────────────────────────────────────
export const addressApi = {
  getAll:    ()                            => _api.get('/addresses'),
  create:    (data: any)                   => _api.post('/addresses', data),
  update:    (id: string, data: any)       => _api.patch(`/addresses/${id}`, data),
  delete:    (id: string)                  => _api.delete(`/addresses/${id}`),
  remove:    (id: string)                  => _api.delete(`/addresses/${id}`),  // alias
  setDefault:(id: string)                  => _api.patch(`/addresses/${id}/default`),

  // GPS save — POST /api/addresses/gps
  // Backend expects: { latitude, longitude, addressText, label? }
  saveGps: (data: { latitude: number; longitude: number; addressText: string; label?: string }) =>
    _api.post('/addresses/gps', data),
};

// ─────────────────────────────────────────────────────────────────
//  MODIFIER GROUP API  (admin)
// ─────────────────────────────────────────────────────────────────
export const modifierGroupApi = {
  getAll: ()                      => _admin.get('/admin/modifier-groups'),
  create: (data: any)             => _admin.post('/admin/modifier-groups', data),
  update: (id: string, data: any) => _admin.patch(`/admin/modifier-groups/${id}`, data),
  remove: (id: string)            => _admin.delete(`/admin/modifier-groups/${id}`),
};
