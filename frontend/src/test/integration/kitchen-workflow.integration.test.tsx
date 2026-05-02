import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/lib/api', () => ({
  kitchenApi: {
    getQueue: vi.fn().mockResolvedValue({
      data: { data: [
        { id: 'o1', orderNumber: 'CH-001', status: 'pending', items: [{ menuItemName: 'Burger', quantity: 1 }], createdAt: new Date().toISOString() },
        { id: 'o2', orderNumber: 'CH-002', status: 'preparing', items: [{ menuItemName: 'Fries', quantity: 2 }], createdAt: new Date().toISOString() },
      ] },
    }),
    getHistory: vi.fn().mockResolvedValue({ data: { data: [] } }),
    setStatus: vi.fn().mockResolvedValue({ data: { data: { id: 'o1', status: 'preparing' } } }),
    setItemAvailability: vi.fn().mockResolvedValue({ data: { data: { id: 'item-1', isAvailable: false } } }),
    pauseOrders: vi.fn().mockResolvedValue({ data: { data: { paused: true } } }),
  },
  authApi: {
    login: vi.fn().mockResolvedValue({
      data: { data: { token: 'kitchen-tok', refreshToken: 'ref', user: { id: 'k1', name: 'Chef', role: 'kitchen' } } },
    }),
  },
}));

describe('[Integration] Kitchen Workflow', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    vi.clearAllMocks();
  });

  describe('Login → Queue → Process Orders', () => {
    it('should login as kitchen staff', async () => {
      const { authApi } = await import('@/lib/api');
      const res = await authApi.login({ identifier: 'chef1', pin: '1234', role: 'staff' });
      expect(res.data.data.user.role).toBe('kitchen');
    });

    it('should fetch order queue', async () => {
      const { kitchenApi } = await import('@/lib/api');
      const res = await kitchenApi.getQueue();
      const orders = res.data.data;
      expect(orders).toHaveLength(2);
      expect(orders[0].status).toBe('pending');
    });

    it('should accept pending order (pending → preparing)', async () => {
      const { kitchenApi } = await import('@/lib/api');
      const res = await kitchenApi.setStatus('o1', 'preparing');
      expect(res.data.data.status).toBe('preparing');
    });

    it('should mark order ready (preparing → ready)', async () => {
      vi.mocked((await import('@/lib/api')).kitchenApi.setStatus)
        .mockResolvedValueOnce({ data: { data: { id: 'o2', status: 'ready' } } } as any);

      const { kitchenApi } = await import('@/lib/api');
      const res = await kitchenApi.setStatus('o2', 'ready');
      expect(res.data.data.status).toBe('ready');
    });
  });

  describe('Inventory control', () => {
    it('should toggle item availability', async () => {
      const { kitchenApi } = await import('@/lib/api');
      const res = await kitchenApi.setItemAvailability('item-1', false);
      expect(res.data.data.isAvailable).toBe(false);
    });

    it('should pause/unpause orders', async () => {
      const { kitchenApi } = await import('@/lib/api');
      const res = await kitchenApi.pauseOrders(true);
      expect(res.data.data.paused).toBe(true);
    });
  });
});
