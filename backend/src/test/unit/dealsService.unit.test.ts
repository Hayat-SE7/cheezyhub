import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  prisma: {
    deal: { findUnique: vi.fn() },
    menuItem: { findMany: vi.fn() },
  },
}));

import { validateDeal, validateDeals } from '../../services/dealsService';
import { prisma } from '../../config/db';
import { buildDeal } from '../helpers';

const mockPrisma = vi.mocked(prisma);

describe('[dealsService] - validateDeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply a flat discount', async () => {
    const deal = buildDeal({ discountType: 'flat', discountValue: 200 });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    const result = await validateDeal('deal-1', [{ menuItemId: 'i1', quantity: 1 }], 1000);
    expect(result.discountAmount).toBe(200);
  });

  it('should apply a percent discount', async () => {
    const deal = buildDeal({ discountType: 'percent', discountValue: 10 });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    const result = await validateDeal('deal-1', [{ menuItemId: 'i1', quantity: 1 }], 1000);
    expect(result.discountAmount).toBe(100); // 10% of 1000
  });

  it('should cap discount at subtotal', async () => {
    const deal = buildDeal({ discountType: 'flat', discountValue: 5000 });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    const result = await validateDeal('deal-1', [{ menuItemId: 'i1', quantity: 1 }], 1000);
    expect(result.discountAmount).toBe(1000); // capped at subtotal
  });

  it('should throw for non-existent deal', async () => {
    mockPrisma.deal.findUnique.mockResolvedValue(null);

    await expect(
      validateDeal('fake', [{ menuItemId: 'i1', quantity: 1 }], 1000)
    ).rejects.toThrow('Deal not found');
  });

  it('should throw for inactive deal', async () => {
    const deal = buildDeal({ isActive: false });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    await expect(
      validateDeal('deal-1', [{ menuItemId: 'i1', quantity: 1 }], 1000)
    ).rejects.toThrow('no longer active');
  });

  it('should throw for deal that hasnt started yet', async () => {
    const deal = buildDeal({ validFrom: new Date(Date.now() + 86400000) });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    await expect(
      validateDeal('deal-1', [{ menuItemId: 'i1', quantity: 1 }], 1000)
    ).rejects.toThrow('has not started yet');
  });

  it('should throw for expired deal', async () => {
    const deal = buildDeal({ validTo: new Date(Date.now() - 86400000) });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    await expect(
      validateDeal('deal-1', [{ menuItemId: 'i1', quantity: 1 }], 1000)
    ).rejects.toThrow('has expired');
  });

  it('should throw for duplicate deal application', async () => {
    await expect(
      validateDeal('deal-1', [{ menuItemId: 'i1', quantity: 1 }], 1000, ['deal-1'])
    ).rejects.toThrow('already been applied');
  });

  it('should throw when linked items are missing from order', async () => {
    const deal = buildDeal({ linkedItemIds: ['item-a', 'item-b'] });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: 'item-a' }, { id: 'item-b' },
    ] as any);

    await expect(
      validateDeal('deal-1', [{ menuItemId: 'item-a', quantity: 1 }], 1000)
    ).rejects.toThrow('requires specific items');
  });

  it('should pass when all linked items are in order', async () => {
    const deal = buildDeal({ linkedItemIds: ['item-a'], discountType: 'flat', discountValue: 50 });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);
    mockPrisma.menuItem.findMany.mockResolvedValue([{ id: 'item-a' }] as any);

    const result = await validateDeal(
      'deal-1',
      [{ menuItemId: 'item-a', quantity: 1 }],
      1000
    );
    expect(result.discountAmount).toBe(50);
  });

  it('should round percent discount to 2 decimal places', async () => {
    const deal = buildDeal({ discountType: 'percent', discountValue: 33 });
    mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

    const result = await validateDeal('deal-1', [{ menuItemId: 'i1', quantity: 1 }], 999);
    // 33% of 999 = 329.67
    expect(result.discountAmount).toBe(329.67);
  });
});

describe('[dealsService] - validateDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply multiple deals sequentially', async () => {
    const deal1 = buildDeal({ id: 'd1', discountType: 'flat', discountValue: 100 });
    const deal2 = buildDeal({ id: 'd2', discountType: 'flat', discountValue: 50 });

    mockPrisma.deal.findUnique
      .mockResolvedValueOnce(deal1 as any)
      .mockResolvedValueOnce(deal2 as any);

    const result = await validateDeals(
      ['d1', 'd2'],
      [{ menuItemId: 'i1', quantity: 1 }],
      1000
    );

    expect(result.totalDiscount).toBe(150);
    expect(result.deals).toHaveLength(2);
  });

  it('should cap total discount at subtotal', async () => {
    const deal1 = buildDeal({ id: 'd1', discountType: 'flat', discountValue: 800 });
    const deal2 = buildDeal({ id: 'd2', discountType: 'flat', discountValue: 800 });

    mockPrisma.deal.findUnique
      .mockResolvedValueOnce(deal1 as any)
      .mockResolvedValueOnce(deal2 as any);

    const result = await validateDeals(
      ['d1', 'd2'],
      [{ menuItemId: 'i1', quantity: 1 }],
      1000
    );

    expect(result.totalDiscount).toBe(1000); // capped
  });

  it('should return empty deals for empty dealIds array', async () => {
    const result = await validateDeals([], [{ menuItemId: 'i1', quantity: 1 }], 1000);
    expect(result.totalDiscount).toBe(0);
    expect(result.deals).toEqual([]);
  });
});
