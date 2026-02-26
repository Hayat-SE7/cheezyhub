// ─────────────────────────────────────────────────────
//  INVENTORY SERVICE
//  Validates availability of items AND their modifiers
//  before an order is placed.
// ─────────────────────────────────────────────────────

import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';

interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  selectedModifierIds: string[];
}

interface ValidatedOrderLine {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  selectedModifiers: { name: string; priceAdjustment: number }[];
}

interface InventoryCheckResult {
  lines: ValidatedOrderLine[];
  subtotal: number;
}

/**
 * Full inventory validation + price calculation.
 * Throws AppError with a human-readable message if anything is unavailable.
 *
 * Checks:
 *   1. Item exists in database
 *   2. Item isAvailable = true
 *   3. Each selected modifier isAvailable = true
 *   4. Required modifier groups have a selection
 */
export async function validateAndPriceOrder(
  items: (OrderLineInput & { notes?: string })[]
): Promise<InventoryCheckResult> {
  const menuItemIds = items.map((i) => i.menuItemId);

  // Load all requested items with their modifiers
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    include: {
      modifierGroups: {
        include: {
          modifiers: true,
        },
      },
    },
  });

  // Check for missing items (wrong ID or deleted)
  const foundIds = new Set(menuItems.map((m) => m.id));
  const missingId = menuItemIds.find((id) => !foundIds.has(id));
  if (missingId) {
    throw new AppError(`Menu item not found: ${missingId}`, 404);
  }

  const lines: ValidatedOrderLine[] = [];
  let subtotal = 0;

  for (const item of items) {
    const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;

    // ── Check 1: Item availability ────────────────────
    if (!menuItem.isAvailable) {
      throw new AppError(
        `"${menuItem.name}" is currently unavailable. Please remove it from your cart.`,
        400
      );
    }

    const allModifiers = menuItem.modifierGroups.flatMap((g) => g.modifiers);

    // ── Check 2: Modifier availability ───────────────
    for (const modId of item.selectedModifierIds) {
      const mod = allModifiers.find((m) => m.id === modId);

      if (!mod) {
        throw new AppError(
          `A selected option for "${menuItem.name}" no longer exists.`,
          400
        );
      }

      if (!mod.isAvailable) {
        throw new AppError(
          `"${mod.name}" for "${menuItem.name}" is currently unavailable. Please update your selection.`,
          400
        );
      }
    }

    // ── Check 3: Required modifier groups filled ──────
    for (const group of menuItem.modifierGroups) {
      if (group.required) {
        const hasSelection = item.selectedModifierIds.some((selectedId) =>
          group.modifiers.some((m) => m.id === selectedId)
        );
        if (!hasSelection) {
          throw new AppError(
            `Please select a "${group.name}" for "${menuItem.name}".`,
            400
          );
        }
      }
    }

    // ── Price calculation ─────────────────────────────
    const selectedModifiers = allModifiers.filter((m) =>
      item.selectedModifierIds.includes(m.id)
    );

    const modifierTotal = selectedModifiers.reduce(
      (sum, m) => sum + m.priceAdjustment,
      0
    );

    const unitPrice = menuItem.basePrice + modifierTotal;
    const totalPrice = unitPrice * item.quantity;
    subtotal += totalPrice;

    lines.push({
      menuItemId: item.menuItemId,
      menuItemName: menuItem.name,
      quantity: item.quantity,
      unitPrice,
      totalPrice,
      notes: item.notes,
      selectedModifiers: selectedModifiers.map((m) => ({
        name: m.name,
        priceAdjustment: m.priceAdjustment,
      })),
    });
  }

  return { lines, subtotal };
}

/**
 * Toggle a menu item's availability.
 * Used by kitchen panel.
 */
export async function setItemAvailability(
  itemId: string,
  isAvailable: boolean
): Promise<void> {
  await prisma.menuItem.update({
    where: { id: itemId },
    data: { isAvailable },
  });
}

/**
 * Toggle a modifier's availability.
 * Used by kitchen panel ("out of cheese").
 */
export async function setModifierAvailability(
  modifierId: string,
  isAvailable: boolean
): Promise<void> {
  await prisma.modifier.update({
    where: { id: modifierId },
    data: { isAvailable },
  });
}
