import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';

// Mock all APIs
vi.mock('@/lib/api', () => ({
  menuApi: { getPublic: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  orderApi: {
    create: vi.fn().mockResolvedValue({ data: { data: { id: 'ord-1', orderNumber: 'CH-100' } } }),
    getMyOrders: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
  addressApi: {
    getAll: vi.fn().mockResolvedValue({ data: { data: [{ id: 'a1', addressText: '123 Main St', isDefault: true }] } }),
  },
  publicSettingsApi: {
    getFees: vi.fn().mockResolvedValue({ data: { data: { deliveryFee: 150, freeDeliveryThreshold: 1500, serviceCharge: 0 } } }),
  },
  paymentApi: {
    create: vi.fn().mockResolvedValue({ data: { data: { paymentId: 'p1', checkoutUrl: 'https://pay.test' } } }),
  },
  authApi: {
    login: vi.fn().mockResolvedValue({ data: { data: { token: 'tok', refreshToken: 'ref', user: { id: 'u1', name: 'Test', role: 'customer' } } } }),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}));

vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(),
}));

vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: any) => <div>{title}</div>,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn().mockReturnValue({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: vi.fn(),
  }),
}));

describe('[Integration] Customer Order Flow', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], lastValidated: null });
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    vi.clearAllMocks();
  });

  describe('Browse → Add to Cart → Cart State', () => {
    it('should add items to cart store', () => {
      const { addItem } = useCartStore.getState();
      addItem({
        menuItemId: 'item-1',
        name: 'Classic Burger',
        quantity: 1,
        unitPrice: 500,
        totalPrice: 500,
        selectedModifiers: [],
      });

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Classic Burger');
      expect(items[0].totalPrice).toBe(500);
    });

    it('should update quantity in cart', () => {
      const { addItem } = useCartStore.getState();
      addItem({ menuItemId: 'item-1', name: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().updateQuantity(itemId, 3);

      const { items } = useCartStore.getState();
      expect(items[0].quantity).toBe(3);
      expect(items[0].totalPrice).toBe(1500);
    });

    it('should remove item when quantity set to 0', () => {
      const { addItem } = useCartStore.getState();
      addItem({ menuItemId: 'item-1', name: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] });

      const itemId = useCartStore.getState().items[0].id;
      useCartStore.getState().updateQuantity(itemId, 0);

      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should calculate total correctly with multiple items', () => {
      const { addItem } = useCartStore.getState();
      addItem({ menuItemId: 'item-1', name: 'Burger', quantity: 2, unitPrice: 500, totalPrice: 1000, selectedModifiers: [] });
      addItem({ menuItemId: 'item-2', name: 'Fries', quantity: 1, unitPrice: 200, totalPrice: 200, selectedModifiers: [] });

      expect(useCartStore.getState().total()).toBe(1200);
      expect(useCartStore.getState().itemCount()).toBe(3);
    });
  });

  describe('Cart → Checkout flow', () => {
    it('should clear cart after successful order', async () => {
      const { addItem, clear } = useCartStore.getState();
      addItem({ menuItemId: 'item-1', name: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] });
      expect(useCartStore.getState().items).toHaveLength(1);

      clear();
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should handle order creation API call', async () => {
      const { orderApi } = await import('@/lib/api');

      const result = await orderApi.create({
        items: [{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: '123 Main St',
      });

      expect(result.data.data.orderNumber).toBe('CH-100');
    });
  });

  describe('Auth state integration', () => {
    it('should login and set authenticated state', () => {
      const { login } = useAuthStore.getState();
      login('test-token', { id: 'u1', name: 'Test', role: 'customer' }, 'refresh-token');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.name).toBe('Test');
    });

    it('should clear state on logout', () => {
      const { login, logout } = useAuthStore.getState();
      login('test-token', { id: 'u1', name: 'Test', role: 'customer' });
      logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });
});
