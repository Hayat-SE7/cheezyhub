import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  prisma: {
    menuItem: { findMany: vi.fn() },
    deal: { findUnique: vi.fn() },
    menuItem2: { findMany: vi.fn() },
  },
}));

import { validateAndPriceOrder } from '../../services/inventoryService';
import { validateDeal } from '../../services/dealsService';
import { prisma } from '../../config/db';

const mockPrisma = vi.mocked(prisma);

describe('[Pricing Precision] - Subtotal Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate exact subtotal for items with modifiers', async () => {
    const item = {
      id: 'i1',
      name: 'Burger',
      basePrice: 499.99,
      isAvailable: true,
      deletedAt: null,
      modifierGroups: [{
        id: 'g1',
        name: 'Extras',
        required: false,
        modifiers: [
          { id: 'm1', name: 'Cheese', priceAdjustment: 50.50, isAvailable: true },
          { id: 'm2', name: 'Bacon', priceAdjustment: 75.25, isAvailable: true },
        ],
      }],
    };
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'i1', quantity: 3, selectedModifierIds: ['m1', 'm2'] },
    ]);

    // unitPrice = 499.99 + 50.50 + 75.25 = 625.74
    // totalPrice = 625.74 * 3 = 1877.22
    expect(result.lines[0].unitPrice).toBe(625.74);
    expect(result.lines[0].totalPrice).toBe(1877.22);
    expect(result.subtotal).toBe(1877.22);
  });

  it('should handle zero-price modifiers', async () => {
    const item = {
      id: 'i1',
      name: 'Pizza',
      basePrice: 800,
      isAvailable: true,
      deletedAt: null,
      modifierGroups: [{
        id: 'g1',
        name: 'Crust',
        required: false,
        modifiers: [
          { id: 'm1', name: 'Regular', priceAdjustment: 0, isAvailable: true },
        ],
      }],
    };
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'i1', quantity: 1, selectedModifierIds: ['m1'] },
    ]);

    expect(result.lines[0].unitPrice).toBe(800);
    expect(result.subtotal).toBe(800);
  });

  it('should accurately sum multiple items with different prices', async () => {
    const items = [
      { id: 'i1', name: 'A', basePrice: 333.33, isAvailable: true, deletedAt: null, modifierGroups: [] },
      { id: 'i2', name: 'B', basePrice: 666.67, isAvailable: true, deletedAt: null, modifierGroups: [] },
    ];
    mockPrisma.menuItem.findMany.mockResolvedValue(items as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'i1', quantity: 1, selectedModifierIds: [] },
      { menuItemId: 'i2', quantity: 1, selectedModifierIds: [] },
    ]);

    expect(result.subtotal).toBe(1000); // 333.33 + 666.67
  });
});

describe('[Pricing Precision] - Discount Rounding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should round percent discount to 2 decimal places', async () => {
    const deal = {
      id: 'd1',
      title: '15% Off',
      discountType: 'percent',
      discountValue: 15,
      isActive: true,
      validFrom: new Date(Date.now() - 86400000),
      validTo: new Date(Date.now() + 86400000),
      linkedItemIds: [],
    };
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    const result = await validateDeal('d1', [{ menuItemId: 'i1', quantity: 1 }], 333);
    // 15% of 333 = 49.95
    expect(result.discountAmount).toBe(49.95);
  });

  it('should handle 33.33% of 100 correctly (repeating decimal)', async () => {
    const deal = {
      id: 'd1',
      title: 'Third Off',
      discountType: 'percent',
      discountValue: 33.33,
      isActive: true,
      validFrom: new Date(Date.now() - 86400000),
      validTo: new Date(Date.now() + 86400000),
      linkedItemIds: [],
    };
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    const result = await validateDeal('d1', [{ menuItemId: 'i1', quantity: 1 }], 100);
    // 33.33% of 100 = 33.33
    expect(result.discountAmount).toBe(33.33);
  });

  it('should not produce negative total (discount capped at subtotal)', async () => {
    const deal = {
      id: 'd1',
      title: 'Big Discount',
      discountType: 'flat',
      discountValue: 99999,
      isActive: true,
      validFrom: new Date(Date.now() - 86400000),
      validTo: new Date(Date.now() + 86400000),
      linkedItemIds: [],
    };
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    const result = await validateDeal('d1', [{ menuItemId: 'i1', quantity: 1 }], 500);
    expect(result.discountAmount).toBe(500); // capped at subtotal
  });

  it('should handle 100% discount exactly', async () => {
    const deal = {
      id: 'd1',
      title: 'Free',
      discountType: 'percent',
      discountValue: 100,
      isActive: true,
      validFrom: new Date(Date.now() - 86400000),
      validTo: new Date(Date.now() + 86400000),
      linkedItemIds: [],
    };
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    const result = await validateDeal('d1', [{ menuItemId: 'i1', quantity: 1 }], 1234.56);
    expect(result.discountAmount).toBe(1234.56);
  });
});
