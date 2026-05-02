import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing the service
vi.mock('../../config/db', () => ({
  prisma: {
    menuItem: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    modifier: {
      update: vi.fn(),
    },
  },
}));

import { validateAndPriceOrder, setItemAvailability, setModifierAvailability } from '../../services/inventoryService';
import { prisma } from '../../config/db';
import { buildMenuItem, buildModifierGroup, buildModifier } from '../helpers';

const mockPrisma = vi.mocked(prisma);

describe('[inventoryService] - validateAndPriceOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate and price a simple order with no modifiers', async () => {
    const item = buildMenuItem({ id: 'item-1', name: 'Burger', basePrice: 500 });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'item-1', quantity: 2, selectedModifierIds: [] },
    ]);

    expect(result.subtotal).toBe(1000);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].unitPrice).toBe(500);
    expect(result.lines[0].totalPrice).toBe(1000);
    expect(result.lines[0].menuItemName).toBe('Burger');
  });

  it('should include modifier price adjustments', async () => {
    const mod = buildModifier({ id: 'mod-1', name: 'Extra Cheese', priceAdjustment: 100, isAvailable: true });
    const group = buildModifierGroup({ id: 'grp-1', name: 'Extras', required: false, modifiers: [mod] });
    const item = buildMenuItem({ id: 'item-1', basePrice: 500, modifierGroups: [group] });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'item-1', quantity: 1, selectedModifierIds: ['mod-1'] },
    ]);

    expect(result.subtotal).toBe(600); // 500 + 100
    expect(result.lines[0].unitPrice).toBe(600);
    expect(result.lines[0].selectedModifiers).toEqual([{ name: 'Extra Cheese', priceAdjustment: 100 }]);
  });

  it('should multiply unit price by quantity', async () => {
    const item = buildMenuItem({ id: 'item-1', basePrice: 300 });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'item-1', quantity: 5, selectedModifierIds: [] },
    ]);

    expect(result.subtotal).toBe(1500);
    expect(result.lines[0].totalPrice).toBe(1500);
  });

  it('should throw 404 for missing menu item', async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([]);

    await expect(
      validateAndPriceOrder([{ menuItemId: 'nonexistent', quantity: 1, selectedModifierIds: [] }])
    ).rejects.toThrow('Menu item not found');
  });

  it('should throw 400 for unavailable item', async () => {
    const item = buildMenuItem({ id: 'item-1', name: 'Sold Out Burger', isAvailable: false });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    await expect(
      validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }])
    ).rejects.toThrow('currently unavailable');
  });

  it('should throw 400 for unavailable modifier', async () => {
    const mod = buildModifier({ id: 'mod-1', name: 'Jalapeño', isAvailable: false });
    const group = buildModifierGroup({ modifiers: [mod] });
    const item = buildMenuItem({ id: 'item-1', modifierGroups: [group] });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    await expect(
      validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: ['mod-1'] }])
    ).rejects.toThrow('currently unavailable');
  });

  it('should throw 400 for modifier not belonging to item', async () => {
    const group = buildModifierGroup({ modifiers: [] }); // no modifiers in this group
    const item = buildMenuItem({ id: 'item-1', modifierGroups: [group] });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    await expect(
      validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: ['unknown-mod'] }])
    ).rejects.toThrow('no longer exists');
  });

  it('should throw 400 when required modifier group has no selection', async () => {
    const mod = buildModifier({ id: 'mod-1', isAvailable: true });
    const group = buildModifierGroup({ name: 'Size', required: true, modifiers: [mod] });
    const item = buildMenuItem({ id: 'item-1', modifierGroups: [group] });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    await expect(
      validateAndPriceOrder([{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }])
    ).rejects.toThrow('Please select a "Size"');
  });

  it('should pass when required modifier group has a selection', async () => {
    const mod = buildModifier({ id: 'mod-1', isAvailable: true, priceAdjustment: 50 });
    const group = buildModifierGroup({ name: 'Size', required: true, modifiers: [mod] });
    const item = buildMenuItem({ id: 'item-1', basePrice: 300, modifierGroups: [group] });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'item-1', quantity: 1, selectedModifierIds: ['mod-1'] },
    ]);

    expect(result.subtotal).toBe(350);
  });

  it('should calculate subtotal across multiple items', async () => {
    const item1 = buildMenuItem({ id: 'item-1', basePrice: 500 });
    const item2 = buildMenuItem({ id: 'item-2', basePrice: 300 });
    mockPrisma.menuItem.findMany.mockResolvedValue([item1, item2] as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'item-1', quantity: 2, selectedModifierIds: [] },
      { menuItemId: 'item-2', quantity: 3, selectedModifierIds: [] },
    ]);

    expect(result.subtotal).toBe(1900); // (500*2) + (300*3)
    expect(result.lines).toHaveLength(2);
  });

  it('should preserve notes on order lines', async () => {
    const item = buildMenuItem({ id: 'item-1', basePrice: 500 });
    mockPrisma.menuItem.findMany.mockResolvedValue([item] as any);

    const result = await validateAndPriceOrder([
      { menuItemId: 'item-1', quantity: 1, selectedModifierIds: [], notes: 'No onions' },
    ]);

    expect(result.lines[0].notes).toBe('No onions');
  });
});

describe('[inventoryService] - setItemAvailability', () => {
  it('should call prisma update with correct params', async () => {
    mockPrisma.menuItem.update.mockResolvedValue({} as any);
    await setItemAvailability('item-1', false);
    expect(mockPrisma.menuItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { isAvailable: false },
    });
  });
});

describe('[inventoryService] - setModifierAvailability', () => {
  it('should call prisma update with correct params', async () => {
    mockPrisma.modifier.update.mockResolvedValue({} as any);
    await setModifierAvailability('mod-1', true);
    expect(mockPrisma.modifier.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: { isAvailable: true },
    });
  });
});
