import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 15000,
});

// Attach JWT from cookie on every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('ch_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove('ch_token');
      Cookies.remove('ch_role');
      // Don't redirect from middleware — let app handle it
      if (typeof window !== 'undefined') {
        const role = localStorage.getItem('ch_role') ?? 'customer';
        const loginPath = role === 'customer' ? '/customer/login' : `/${role}/login`;
        window.location.href = loginPath;
      }
    }
    return Promise.reject(err);
  }
);

export default api;

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
};

export const menuApi = {
  // Public
  getPublic: ()                      => api.get('/menu'),
  // Admin + kitchen — full list
  getAll:    ()                      => api.get('/menu/all'),
  // Single item (for editing)
  getItem:   (id: string)            => api.get(`/menu/items/${id}`),
  // Item CRUD
  createItem: (data: any)            => api.post('/menu/items', data),
  updateItem: (id: string, data: any)=> api.patch(`/menu/items/${id}`, data),
  deleteItem: (id: string)           => api.delete(`/menu/items/${id}`),
  // Category CRUD
  getCategories: ()                  => api.get('/menu/categories'),
  createCategory:(name: string, sortOrder?: number) =>
    api.post('/menu/categories', { name, sortOrder }),
  updateCategory:(id: string, data: { name?: string; sortOrder?: number }) =>
    api.patch(`/menu/categories/${id}`, data),
  deleteCategory:(id: string)        => api.delete(`/menu/categories/${id}`),
  // Availability toggles (kitchen/admin)
  setItemAvailability:    (id: string, isAvailable: boolean) =>
    api.patch(`/menu/items/${id}/availability`, { isAvailable }),
  setModifierAvailability:(id: string, isAvailable: boolean) =>
    api.patch(`/menu/modifiers/${id}/availability`, { isAvailable }),
};

export const orderApi = {
  place: (data: any) => api.post('/orders', data),
  getMyOrders: () => api.get('/orders'),
  getOrder: (id: string) => api.get(`/orders/${id}`),
};

// --- Merged Address API (v6.1) ---
export const addressApi = {
  getAll:     ()                          => api.get('/addresses'),
  create:     (data: any)                 => api.post('/addresses', data),
  update:     (id: string, data: any)     => api.patch(`/addresses/${id}`, data),
  remove:     (id: string)                => api.delete(`/addresses/${id}`),
  setDefault: (id: string)                => api.patch(`/addresses/${id}/set-default`),
  saveGps:    (data: { latitude: number; longitude: number; addressText: string }) =>
    api.post('/addresses/save-gps', data),
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
  getQueue: () => api.get('/kitchen/orders'),
  getHistory: () => api.get('/kitchen/orders/history'),
  setStatus: (id: string, status: string) =>
    api.patch(`/kitchen/orders/${id}/status`, { status }),
  // Inventory control
  setItemAvailability: (id: string, isAvailable: boolean) =>
    api.patch(`/kitchen/inventory/items/${id}`, { isAvailable }),
  setModifierAvailability: (id: string, isAvailable: boolean) =>
    api.patch(`/kitchen/inventory/modifiers/${id}`, { isAvailable }),
  pauseOrders: (paused: boolean) => api.patch('/kitchen/pause', { paused }),
};

export const deliveryApi = {
  getMyOrders: () => api.get('/delivery/orders'),
  getHistory: () => api.get('/delivery/orders/history'),
  setStatus: (id: string, status: string) =>
    api.patch(`/delivery/orders/${id}/status`, { status }),
  getMapsUrl: (id: string) => api.get(`/delivery/orders/${id}/maps`),
};

export const adminApi = {
  // Dashboard
  getStats: () => api.get('/admin/stats'),
  // Orders
  getOrders: (params?: Record<string, any>) => api.get('/admin/orders', { params }),
  assignDriver: (orderId: string, driverId: string) =>
    api.patch(`/admin/orders/${orderId}/assign`, { driverId }),
  cancelOrder: (orderId: string) => api.patch(`/admin/orders/${orderId}/cancel`),
  // Staff
  getStaff: () => api.get('/admin/staff'),
  createStaff: (data: { username: string; pin: string; role: string }) =>
    api.post('/admin/staff', data),
  updateStaff: (id: string, data: { isActive?: boolean; pin?: string }) =>
    api.patch(`/admin/staff/${id}`, data),
  deleteStaff: (id: string) => api.delete(`/admin/staff/${id}`),
  // Drivers for assignment dropdown
  getDrivers: () => api.get('/admin/drivers'),
  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data: Record<string, any>) => api.patch('/admin/settings', data),
  // Notification log + retry
  getNotifications: () => api.get('/admin/notifications'),
  retryNotification: (id: string) => api.post(`/admin/notifications/${id}/retry`),
};

export const ticketApi = {
  create: (data: any) => api.post('/tickets', data),
  getAll: () => api.get('/tickets'),
  get: (id: string) => api.get(`/tickets/${id}`),
  reply: (id: string, message: string) => api.post(`/tickets/${id}/reply`, { message }),
  setStatus: (id: string, status: string) => api.patch(`/tickets/${id}/status`, { status }),
};

export const dealsApi = {
  // Public
  getActive:  ()            => api.get('/deals'),
  getSlider:  ()            => api.get('/deals/slider'),
  // Admin
  getAll:     ()            => api.get('/deals/admin'),
  create:     (data: any)   => api.post('/deals/admin', data),
  update:     (id: string, data: any) => api.patch(`/deals/admin/${id}`, data),
  remove:     (id: string)  => api.delete(`/deals/admin/${id}`),
  toggle:     (id: string)  => api.patch(`/deals/admin/${id}/toggle`),
};

export const analyticsApi = {
  getDashboard: () => api.get('/admin/analytics'),
};