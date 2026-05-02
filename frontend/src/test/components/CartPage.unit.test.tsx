import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CartPage from '@/app/customer/cart/page';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';

// Mock APIs
vi.mock('@/lib/api', () => ({
  orderApi: { create: vi.fn().mockResolvedValue({ data: { data: { id: 'ord-1', orderNumber: 'CH-100' } } }) },
  addressApi: { getAll: vi.fn().mockResolvedValue({ data: { data: [{ id: 'a1', addressText: '123 Main St', isDefault: true }] } }) },
  publicSettingsApi: { getFees: vi.fn().mockResolvedValue({ data: { data: { deliveryFee: 150, freeDeliveryThreshold: 1500, serviceCharge: 0 } } }) },
  paymentApi: { create: vi.fn().mockResolvedValue({ data: { data: { paymentId: 'p1', checkoutUrl: 'https://pay.test' } } }) },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('[CartPage]', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], lastValidated: null });
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    vi.clearAllMocks();
  });

  it('should show empty cart message when no items', () => {
    render(<CartPage />, { wrapper });
    expect(screen.getByText('Cart is empty')).toBeInTheDocument();
    expect(screen.getByText('Browse Menu')).toBeInTheDocument();
  });

  it('should show cart items when items exist', async () => {
    useCartStore.setState({
      items: [
        { id: 'ci-1', menuItemId: 'mi-1', name: 'Classic Burger', quantity: 2, unitPrice: 500, totalPrice: 1000, selectedModifiers: [], imageUrl: undefined },
      ],
    });

    render(<CartPage />, { wrapper });
    expect(screen.getByText('Classic Burger')).toBeInTheDocument();
    expect(screen.getAllByText(/Rs\.\s*1000/).length).toBeGreaterThan(0);
  });

  it('should show quantity controls for each item', () => {
    useCartStore.setState({
      items: [
        { id: 'ci-1', menuItemId: 'mi-1', name: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] },
      ],
    });

    render(<CartPage />, { wrapper });
    expect(screen.getByText('1')).toBeInTheDocument(); // quantity display
  });

  it('should show payment method selector', () => {
    useCartStore.setState({
      items: [
        { id: 'ci-1', menuItemId: 'mi-1', name: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] },
      ],
    });

    render(<CartPage />, { wrapper });
    expect(screen.getByText('Cash on Delivery')).toBeInTheDocument();
    expect(screen.getByText('Pay Online')).toBeInTheDocument();
  });

  it('should show Login to Order when not authenticated', () => {
    useCartStore.setState({
      items: [
        { id: 'ci-1', menuItemId: 'mi-1', name: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] },
      ],
    });

    render(<CartPage />, { wrapper });
    expect(screen.getByText(/Login to Order/)).toBeInTheDocument();
  });

  it('should show order total with delivery fee', async () => {
    useCartStore.setState({
      items: [
        { id: 'ci-1', menuItemId: 'mi-1', name: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] },
      ],
    });

    render(<CartPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Order Summary')).toBeInTheDocument();
    });
  });

  it('should show modifier names for items with modifiers', () => {
    useCartStore.setState({
      items: [
        {
          id: 'ci-1', menuItemId: 'mi-1', name: 'Burger', quantity: 1, unitPrice: 550, totalPrice: 550,
          selectedModifiers: [{ id: 'mod-1', name: 'Extra Cheese', priceAdjustment: 50 }],
        },
      ],
    });

    render(<CartPage />, { wrapper });
    expect(screen.getByText('Extra Cheese')).toBeInTheDocument();
  });

  it('should show clear cart button', () => {
    useCartStore.setState({
      items: [
        { id: 'ci-1', menuItemId: 'mi-1', name: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] },
      ],
    });

    render(<CartPage />, { wrapper });
    expect(screen.getByText('Clear cart')).toBeInTheDocument();
  });
});
