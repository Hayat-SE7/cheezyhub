import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  prisma: {
    menuItem: { findMany: vi.fn() },
    deal: { findUnique: vi.fn() },
  },
}));

import { validateAndPriceOrder } from '../../services/inventoryService';
import { validateDeal } from '../../services/dealsService';
import { prisma } from '../../config/db';

const mockPrisma = vi.mocked(prisma);

describe('[Security] - SQL Injection Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sqlPayloads = [
    "' OR 1=1 --",
    "'; DROP TABLE users;--",
    "1' UNION SELECT * FROM users--",
    "admin'--",
    "1; DELETE FROM orders WHERE 1=1",
  ];

  sqlPayloads.forEach((payload) => {
    it(`should safely handle SQL injection payload in menuItemId: "${payload}"`, async () => {
      // Prisma uses parameterized queries, so the payload is treated as a literal string
      // The service should throw "Menu item not found" because no item matches the injection string
      mockPrisma.menuItem.findMany.mockResolvedValue([]);

      await expect(
        validateAndPriceOrder([{ menuItemId: payload, quantity: 1, selectedModifierIds: [] }])
      ).rejects.toThrow('Menu item not found');

      // Verify findMany was called with the literal string (not executed as SQL)
      expect(mockPrisma.menuItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [payload] },
          }),
        })
      );
    });
  });
});

describe('[Security] - XSS Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const xssPayloads = [
    '<script>alert(1)</script>',
    '"><img onerror=alert(1) src=x>',
    "javascript:alert('xss')",
    '<svg onload=alert(1)>',
    '{{constructor.constructor("alert(1)")()}}',
  ];

  xssPayloads.forEach((payload) => {
    it(`should treat XSS payload as literal string in notes: "${payload.slice(0, 30)}..."`, async () => {
      const item = {
        id: 'item-1',
        name: 'Burger',
        basePrice: 500,
        isAvailable: true,
        deletedAt: null,
        modifierGroups: [],
      };
      mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

      const result = await validateAndPriceOrder([
        { menuItemId: 'item-1', quantity: 1, selectedModifierIds: [], notes: payload },
      ]);

      // The XSS payload is stored as-is (Prisma escapes on output)
      // The service should not execute or transform it
      expect(result.lines[0].notes).toBe(payload);
    });
  });
});
