import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';

const mockOrders = vi.hoisted(() => [
  {
    id: 'ord-1', orderNumber: 'CH-001', status: 'preparing', total: 700, subtotal: 550, deliveryFee: 150, serviceCharge: 0,
    deliveryAddress: '123 Main St', createdAt: new Date().toISOString(),
    items: [{ id: 'oi-1', menuItemId: 'mi-1', menuItemName: 'Burger', quantity: 1, unitPrice: 550, totalPrice: 550, selectedModifiers: [] }],
  },
  {
    id: 'ord-2', orderNumber: 'CH-002', status: 'completed', total: 400, subtotal: 400, deliveryFee: 0, serviceCharge: 0,
    deliveryAddress: '456 Oak Ave', createdAt: new Date(Date.now() - 86400000).toISOString(),
    items: [{ id: 'oi-2', menuItemId: 'mi-2', menuItemName: 'Fries', quantity: 2, unitPrice: 200, totalPrice: 400, selectedModifiers: [] }],
  },
]);

vi.mock('@/lib/api', () => ({
  orderApi: { getMyOrders: vi.fn().mockResolvedValue({ data: { data: mockOrders } }) },
}));

vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  toast: vi.fn(),
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

import CustomerOrdersPage from '@/app/customer/orders/page';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('[OrdersPage]', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', name: 'Test', role: 'customer' }, token: 'tok', isAuthenticated: true });
    vi.clearAllMocks();
  });

  it('should render page title', () => {
    render(<CustomerOrdersPage />, { wrapper: createWrapper() });
    expect(screen.getByText('My Orders')).toBeInTheDocument();
  });

  it('should show active orders with live tracking', async () => {
    render(<CustomerOrdersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Live Tracking')).toBeInTheDocument();
      expect(screen.getByText('CH-001')).toBeInTheDocument();
    });
  });

  it('should show past orders section', async () => {
    render(<CustomerOrdersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Past Orders')).toBeInTheDocument();
      expect(screen.getByText('CH-002')).toBeInTheDocument();
    });
  });

  it('should show empty state when no orders', async () => {
    const { orderApi } = await import('@/lib/api');
    vi.mocked(orderApi.getMyOrders).mockResolvedValueOnce({ data: { data: [] } } as any);

    render(<CustomerOrdersPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No orders yet')).toBeInTheDocument();
    });
  });

  it('should not render when not authenticated', () => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    const { container } = render(<CustomerOrdersPage />, { wrapper: createWrapper() });
    expect(container.innerHTML).toBe('');
  });
});
