import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDeal } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    deal: { findUnique: vi.fn() },
    menuItem: { findMany: vi.fn() },
  },
}));

import { prisma } from '../../config/db';
import { validateDeals, validateDeal } from '../../services/dealsService';

const mockPrisma = vi.mocked(prisma);

describe('[Integration] Deal Flow', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Active deal application', () => {
    it('should apply percent discount to order subtotal', async () => {
      const deal = buildDeal({ id: 'deal-1', discountType: 'percent', discountValue: 10, linkedItemIds: [] });
      mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

      const result = await validateDeals(['deal-1'], [{ menuItemId: 'item-1', quantity: 1 }], 1000);
      expect(result.totalDiscount).toBe(100);
    });

    it('should apply flat discount', async () => {
      const deal = buildDeal({ id: 'deal-1', discountType: 'flat', discountValue: 200, linkedItemIds: [] });
      mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

      const result = await validateDeals(['deal-1'], [{ menuItemId: 'item-1', quantity: 1 }], 1000);
      expect(result.totalDiscount).toBe(200);
    });

    it('should cap discount at subtotal', async () => {
      const deal = buildDeal({ id: 'deal-1', discountType: 'flat', discountValue: 2000, linkedItemIds: [] });
      mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

      const result = await validateDeals(['deal-1'], [{ menuItemId: 'item-1', quantity: 1 }], 1000);
      expect(result.totalDiscount).toBeLessThanOrEqual(1000);
    });

    it('should reject expired deals', async () => {
      const deal = buildDeal({ id: 'deal-1', validTo: new Date(Date.now() - 86400000) });
      mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

      await expect(validateDeals(['deal-1'], [{ menuItemId: 'item-1', quantity: 1 }], 1000))
        .rejects.toThrow(/expired/);
    });

    it('should reject inactive deals', async () => {
      const deal = buildDeal({ id: 'deal-1', isActive: false });
      mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

      await expect(validateDeals(['deal-1'], [{ menuItemId: 'item-1', quantity: 1 }], 1000))
        .rejects.toThrow(/no longer active/);
    });
  });

  describe('Linked item deals', () => {
    it('should apply discount when linked items are in order', async () => {
      const deal = buildDeal({ id: 'deal-1', linkedItemIds: ['item-1', 'item-2'], discountType: 'flat', discountValue: 100 });
      mockPrisma.deal.findUnique.mockResolvedValue(deal as any);
      mockPrisma.menuItem.findMany.mockResolvedValue([{ id: 'item-1' }, { id: 'item-2' }] as any);

      const result = await validateDeals(
        ['deal-1'],
        [{ menuItemId: 'item-1', quantity: 1 }, { menuItemId: 'item-2', quantity: 1 }],
        1000
      );
      expect(result.totalDiscount).toBe(100);
    });

    it('should reject when linked items are missing from order', async () => {
      const deal = buildDeal({ id: 'deal-1', linkedItemIds: ['item-1', 'item-2'], discountType: 'flat', discountValue: 100 });
      mockPrisma.deal.findUnique.mockResolvedValue(deal as any);
      mockPrisma.menuItem.findMany.mockResolvedValue([{ id: 'item-1' }, { id: 'item-2' }] as any);

      await expect(
        validateDeals(['deal-1'], [{ menuItemId: 'item-1', quantity: 1 }], 1000)
      ).rejects.toThrow(/requires specific items/);
    });

    it('should reject duplicate deal application', async () => {
      const deal = buildDeal({ id: 'deal-1', discountType: 'flat', discountValue: 50, linkedItemIds: [] });
      mockPrisma.deal.findUnique.mockResolvedValue(deal as any);

      await expect(
        validateDeals(['deal-1', 'deal-1'], [{ menuItemId: 'item-1', quantity: 1 }], 1000)
      ).rejects.toThrow(/already been applied/);
    });
  });
});
