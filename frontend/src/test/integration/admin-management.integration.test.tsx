import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/lib/api', () => ({
  adminApi: {
    getStats: vi.fn().mockResolvedValue({ data: { data: { totalOrders: 50, revenue: 25000, activeDrivers: 3 } } }),
    getStaff: vi.fn().mockResolvedValue({ data: { data: [{ id: 's1', username: 'chef1', role: 'kitchen', isActive: true }] } }),
    createStaff: vi.fn().mockResolvedValue({ data: { data: { id: 's2', username: 'newstaff', role: 'kitchen' } } }),
    updateStaff: vi.fn().mockResolvedValue({ data: { data: { id: 's1', isActive: false } } }),
    deleteStaff: vi.fn().mockResolvedValue({ data: { success: true } }),
    getSettings: vi.fn().mockResolvedValue({ data: { data: { deliveryFee: 150, ordersAccepting: true } } }),
    updateSettings: vi.fn().mockResolvedValue({ data: { data: { deliveryFee: 200 } } }),
    getOrders: vi.fn().mockResolvedValue({ data: { data: { items: [], total: 0 } } }),
  },
  authApi: {
    login: vi.fn().mockResolvedValue({
      data: { data: { token: 'admin-tok', refreshToken: 'ref', user: { id: 'a1', name: 'Admin', role: 'admin' } } },
    }),
  },
}));

describe('[Integration] Admin Management', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    vi.clearAllMocks();
  });

  describe('Login → Dashboard', () => {
    it('should login as admin and fetch dashboard stats', async () => {
      const { authApi, adminApi } = await import('@/lib/api');

      // Login
      const loginRes = await authApi.login({ identifier: 'admin', pin: '1234', role: 'staff' });
      expect(loginRes.data.data.user.role).toBe('admin');

      // Set auth state
      useAuthStore.getState().login(
        loginRes.data.data.token,
        loginRes.data.data.user,
        loginRes.data.data.refreshToken
      );
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Fetch stats
      const statsRes = await adminApi.getStats();
      expect(statsRes.data.data.totalOrders).toBe(50);
    });
  });

  describe('Staff CRUD', () => {
    it('should create a new staff member', async () => {
      const { adminApi } = await import('@/lib/api');
      const res = await adminApi.createStaff({ username: 'newchef', pin: '1234', role: 'kitchen' });
      expect(res.data.data.username).toBe('newstaff');
    });

    it('should deactivate a staff member', async () => {
      const { adminApi } = await import('@/lib/api');
      const res = await adminApi.updateStaff('s1', { isActive: false });
      expect(res.data.data.isActive).toBe(false);
    });

    it('should delete a staff member', async () => {
      const { adminApi } = await import('@/lib/api');
      const res = await adminApi.deleteStaff('s1');
      expect(res.data.success).toBe(true);
    });
  });

  describe('Settings management', () => {
    it('should fetch and update settings', async () => {
      const { adminApi } = await import('@/lib/api');

      const getRes = await adminApi.getSettings();
      expect(getRes.data.data.deliveryFee).toBe(150);

      const updateRes = await adminApi.updateSettings({ deliveryFee: 200 });
      expect(updateRes.data.data.deliveryFee).toBe(200);
    });
  });
});
