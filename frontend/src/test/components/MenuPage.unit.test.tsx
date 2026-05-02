import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMenu = vi.hoisted(() => [
  {
    id: 'cat-1', name: 'Burgers',
    items: [
      { id: 'item-1', name: 'Classic Burger', description: 'Beef patty', basePrice: 500, imageUrl: null, isAvailable: true, modifierGroups: [] },
      { id: 'item-2', name: 'Cheese Burger', description: 'With extra cheese', basePrice: 600, imageUrl: null, isAvailable: true, modifierGroups: [] },
    ],
  },
  {
    id: 'cat-2', name: 'Sides',
    items: [
      { id: 'item-3', name: 'Fries', description: 'Crispy golden fries', basePrice: 200, imageUrl: null, isAvailable: true, modifierGroups: [] },
    ],
  },
]);

vi.mock('@/lib/api', () => ({
  menuApi: {
    getPublic: vi.fn().mockResolvedValue({ data: { data: mockMenu } }),
  },
}));

vi.mock('@/components/customer/MenuItemCard', () => ({
  default: ({ item, onOpenSheet }: any) => (
    <div data-testid={`menu-item-${item.id}`} onClick={() => onOpenSheet(item)}>
      <span>{item.name}</span>
      <span>Rs. {item.basePrice}</span>
    </div>
  ),
}));

vi.mock('@/components/customer/ItemBottomSheet', () => ({
  default: ({ item, isOpen }: any) =>
    isOpen && item ? <div data-testid="bottom-sheet">{item.name}</div> : null,
}));

import MenuPage from '@/app/customer/menu/page';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('[MenuPage]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading skeletons initially', () => {
    const { container } = render(<MenuPage />, { wrapper: createWrapper() });
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('should render categories after loading', async () => {
    render(<MenuPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getAllByText('Burgers').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sides').length).toBeGreaterThan(0);
    });
  });

  it('should render menu items', async () => {
    render(<MenuPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Classic Burger')).toBeInTheDocument();
      expect(screen.getByText('Fries')).toBeInTheDocument();
    });
  });

  it('should have a search input', async () => {
    render(<MenuPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search the menu/)).toBeInTheDocument();
    });
  });

  it('should filter items by search query', async () => {
    render(<MenuPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Classic Burger')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Search the menu/), { target: { value: 'Fries' } });

    await waitFor(() => {
      expect(screen.getByText('Fries')).toBeInTheDocument();
      expect(screen.queryByText('Classic Burger')).not.toBeInTheDocument();
    });
  });

  it('should show empty state for no search results', async () => {
    render(<MenuPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Classic Burger')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Search the menu/), { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText(/Nothing found for/)).toBeInTheDocument();
    });
  });

  it('should open bottom sheet when clicking an item', async () => {
    render(<MenuPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('menu-item-item-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('menu-item-item-1'));

    await waitFor(() => {
      expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument();
    });
  });
});
