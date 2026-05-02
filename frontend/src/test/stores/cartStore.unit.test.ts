import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCartStore } from '@/store/cartStore';

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

function createCartItem(overrides = {}) {
  return {
    menuItemId: 'menu-1',
    name: 'Test Burger',
    quantity: 1,
    unitPrice: 500,
    totalPrice: 500,
    selectedModifiers: [],
    ...overrides,
  };
}

describe('[cartStore]', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], lastValidated: null });
    uuidCounter = 0;
  });

  describe('addItem', () => {
    it('should add an item to empty cart', () => {
      useCartStore.getState().addItem(createCartItem());
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].name).toBe('Test Burger');
      expect(useCartStore.getState().items[0].id).toBe('test-uuid-1');
    });

    it('should add multiple distinct items', () => {
      useCartStore.getState().addItem(createCartItem({ name: 'Burger' }));
      useCartStore.getState().addItem(createCartItem({ name: 'Pizza' }));
      expect(useCartStore.getState().items).toHaveLength(2);
    });

    it('should preserve modifiers on added item', () => {
      const mods = [{ id: 'm1', name: 'Extra Cheese', priceAdjustment: 100 }];
      useCartStore.getState().addItem(createCartItem({
        selectedModifiers: mods,
        unitPrice: 600,
        totalPrice: 600,
      }));
      expect(useCartStore.getState().items[0].selectedModifiers).toEqual(mods);
    });
  });

  describe('updateQuantity', () => {
    it('should update quantity and recalculate totalPrice', () => {
      useCartStore.getState().addItem(createCartItem({ unitPrice: 500, totalPrice: 500 }));
      const id = useCartStore.getState().items[0].id;

      useCartStore.getState().updateQuantity(id, 3);

      const item = useCartStore.getState().items[0];
      expect(item.quantity).toBe(3);
      expect(item.totalPrice).toBe(1500);
    });

    it('should remove item when quantity is 0', () => {
      useCartStore.getState().addItem(createCartItem());
      const id = useCartStore.getState().items[0].id;

      useCartStore.getState().updateQuantity(id, 0);

      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should remove item when quantity is negative', () => {
      useCartStore.getState().addItem(createCartItem());
      const id = useCartStore.getState().items[0].id;

      useCartStore.getState().updateQuantity(id, -1);

      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('removeItem', () => {
    it('should remove item by id', () => {
      useCartStore.getState().addItem(createCartItem({ name: 'Burger' }));
      useCartStore.getState().addItem(createCartItem({ name: 'Pizza' }));
      const burgerId = useCartStore.getState().items[0].id;

      useCartStore.getState().removeItem(burgerId);

      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].name).toBe('Pizza');
    });

    it('should do nothing for non-existent id', () => {
      useCartStore.getState().addItem(createCartItem());
      useCartStore.getState().removeItem('nonexistent');
      expect(useCartStore.getState().items).toHaveLength(1);
    });
  });

  describe('clearCart / clear', () => {
    it('should remove all items', () => {
      useCartStore.getState().addItem(createCartItem());
      useCartStore.getState().addItem(createCartItem());
      useCartStore.getState().clearCart();
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('clear() should also remove all items', () => {
      useCartStore.getState().addItem(createCartItem());
      useCartStore.getState().clear();
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('total', () => {
    it('should return 0 for empty cart', () => {
      expect(useCartStore.getState().total()).toBe(0);
    });

    it('should sum all item totalPrices', () => {
      useCartStore.getState().addItem(createCartItem({ totalPrice: 500 }));
      useCartStore.getState().addItem(createCartItem({ totalPrice: 300 }));
      expect(useCartStore.getState().total()).toBe(800);
    });
  });

  describe('itemCount', () => {
    it('should return 0 for empty cart', () => {
      expect(useCartStore.getState().itemCount()).toBe(0);
    });

    it('should sum all item quantities', () => {
      useCartStore.getState().addItem(createCartItem({ quantity: 2 }));
      useCartStore.getState().addItem(createCartItem({ quantity: 3 }));
      expect(useCartStore.getState().itemCount()).toBe(5);
    });
  });

  describe('validateCart', () => {
    it('should return empty array for empty cart', async () => {
      const removed = await useCartStore.getState().validateCart();
      expect(removed).toEqual([]);
    });

    it('should return empty array on network error (no items removed)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      useCartStore.getState().addItem(createCartItem());

      const removed = await useCartStore.getState().validateCart();
      expect(removed).toEqual([]);
      expect(useCartStore.getState().items).toHaveLength(1);
    });

    it('should remove items not in menu response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ items: [{ id: 'menu-1', isAvailable: true, modifierGroups: [] }] }],
        }),
      }));

      useCartStore.getState().addItem(createCartItem({ menuItemId: 'menu-1', name: 'Burger' }));
      useCartStore.getState().addItem(createCartItem({ menuItemId: 'menu-999', name: 'Ghost Item' }));

      const removed = await useCartStore.getState().validateCart();
      expect(removed).toContain('Ghost Item');
      expect(useCartStore.getState().items).toHaveLength(1);
    });

    it('should remove items that are unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ items: [{ id: 'menu-1', isAvailable: false, modifierGroups: [] }] }],
        }),
      }));

      useCartStore.getState().addItem(createCartItem({ menuItemId: 'menu-1', name: 'Sold Out' }));

      const removed = await useCartStore.getState().validateCart();
      expect(removed).toContain('Sold Out');
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should remove items with unavailable modifiers', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{
            items: [{
              id: 'menu-1',
              isAvailable: true,
              modifierGroups: [{
                modifiers: [{ id: 'mod-available', isAvailable: true }],
              }],
            }],
          }],
        }),
      }));

      useCartStore.getState().addItem(createCartItem({
        menuItemId: 'menu-1',
        name: 'Burger',
        selectedModifiers: [{ id: 'mod-removed', name: 'Removed Mod', priceAdjustment: 50 }],
      }));

      const removed = await useCartStore.getState().validateCart();
      expect(removed).toContain('Burger (unavailable options)');
    });

    it('should update lastValidated timestamp', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ items: [{ id: 'menu-1', isAvailable: true, modifierGroups: [] }] }],
        }),
      }));

      useCartStore.getState().addItem(createCartItem({ menuItemId: 'menu-1' }));
      expect(useCartStore.getState().lastValidated).toBeNull();

      await useCartStore.getState().validateCart();
      expect(useCartStore.getState().lastValidated).toBeGreaterThan(0);
    });
  });
});
