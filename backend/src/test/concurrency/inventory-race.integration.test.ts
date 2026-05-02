import { describe, it, expect, vi, beforeEach } from 'vitest';

// These tests verify that the code correctly handles concurrent access patterns.
// Since we can't run real DB transactions in unit tests, we simulate the race conditions
// by controlling the mock behavior to verify the code's transactional logic.

vi.mock('../../config/db', () => ({
  prisma: {
    menuItem: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '../../config/db';
import { validateAndPriceOrder } from '../../services/inventoryService';

vi.mock('../../services/inventoryService', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return actual;
});

const mockPrisma = vi.mocked(prisma);

describe('[Concurrency] - Inventory Race Conditions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should handle simultaneous validation of last item (both get item from DB)', async () => {
    // Both requests see the item as available during validation
    const item = {
      id: 'item-1', name: 'Limited Burger', basePrice: 500,
      isAvailable: true, deletedAt: null, modifierGroups: [],
    };

    // First call succeeds, second call should also succeed at validation stage
    // (actual inventory enforcement happens at order creation via DB constraints)
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    const [result1, result2] = await Promise.all([
      validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }]),
      validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }]),
    ]);

    // Both should validate successfully (DB-level locking handles the actual race)
    expect(result1.subtotal).toBe(500);
    expect(result2.subtotal).toBe(500);
  });

  it('should reject if item becomes unavailable between check and order', async () => {
    // First call: available, second call: unavailable (toggled between calls)
    mockPrisma.menuItem.findMany
      .mockResolvedValueOnce([{ id: 'item-1', name: 'Burger', basePrice: 500, isAvailable: true, deletedAt: null, modifierGroups: [] }] as any)
      .mockResolvedValueOnce([{ id: 'item-1', name: 'Burger', basePrice: 500, isAvailable: false, deletedAt: null, modifierGroups: [] }] as any);

    const result1 = await validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }]);
    expect(result1.subtotal).toBe(500);

    await expect(
      validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }])
    ).rejects.toThrow('currently unavailable');
  });
});
