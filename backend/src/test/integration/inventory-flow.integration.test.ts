import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMenuItem, buildModifierGroup, buildModifier } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    menuItem: { findMany: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from '../../config/db';
import { validateAndPriceOrder } from '../../services/inventoryService';

const mockPrisma = vi.mocked(prisma);

describe('[Integration] Inventory Flow', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Available item validation', () => {
    it('should validate available items and compute subtotal', async () => {
      const item = buildMenuItem({ id: 'item-1', name: 'Burger', basePrice: 500, isAvailable: true, modifierGroups: [] });
      mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

      const result = await validateAndPriceOrder([
        { menuItemId: 'item-1', quantity: 2, selectedModifierIds: [] },
      ]);

      expect(result.subtotal).toBe(1000);
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].menuItemName).toBe('Burger');
    });
  });

  describe('Unavailable item rejection', () => {
    it('should reject unavailable items', async () => {
      const item = buildMenuItem({ id: 'item-1', isAvailable: false, modifierGroups: [] });
      mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

      await expect(
        validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }])
      ).rejects.toThrow(/unavailable/);
    });
  });

  describe('Missing/deleted items', () => {
    it('should reject items not found in DB (deleted or nonexistent)', async () => {
      // findMany with deletedAt: null filter returns empty for deleted items
      mockPrisma.menuItem.findMany.mockResolvedValue([]);

      await expect(
        validateAndPriceOrder([{ menuItemId: 'nonexistent', quantity: 1, selectedModifierIds: [] }])
      ).rejects.toThrow(/not found/);
    });
  });

  describe('Modifier pricing', () => {
    it('should include modifier price adjustments in subtotal', async () => {
      const mod = buildModifier({ id: 'mod-1', priceAdjustment: 100, isAvailable: true });
      const group = buildModifierGroup({ id: 'mg-1', modifiers: [mod] });
      const item = buildMenuItem({
        id: 'item-1', name: 'Burger', basePrice: 500,
        modifierGroups: [{ ...group, modifiers: [mod] }],
      });

      mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

      const result = await validateAndPriceOrder([
        { menuItemId: 'item-1', quantity: 1, selectedModifierIds: ['mod-1'] },
      ]);

      expect(result.subtotal).toBe(600);
    });

    it('should reject unavailable modifiers', async () => {
      const mod = buildModifier({ id: 'mod-1', isAvailable: false });
      const group = buildModifierGroup({ id: 'mg-1', modifiers: [mod] });
      const item = buildMenuItem({
        id: 'item-1', basePrice: 500,
        modifierGroups: [{ ...group, modifiers: [mod] }],
      });

      mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

      await expect(
        validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: ['mod-1'] }])
      ).rejects.toThrow();
    });
  });
});
