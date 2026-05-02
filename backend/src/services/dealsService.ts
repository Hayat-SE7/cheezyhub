// ─────────────────────────────────────────────────────
//  DEALS VALIDATION SERVICE
//  Server-side validation of deals applied at order placement.
//
//  Validates:
//    1. Deal exists and is active
//    2. Deal is within validity window (validFrom/validTo)
//    3. All linkedItemIds are present in the order
//    4. Discount calculation is correct
//    5. Same deal cannot be applied twice
// ─────────────────────────────────────────────────────

import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';

export interface AppliedDeal {
  dealId: string;
  discountAmount: number;
}

interface OrderItemInput {
  menuItemId: string;
  quantity: number;
}

/**
 * Validate and calculate discount for a deal applied to an order.
 * Returns the validated discount amount.
 * Throws AppError if the deal is invalid.
 */
export async function validateDeal(
  dealId: string,
  orderItems: OrderItemInput[],
  subtotal: number,
  appliedDealIds: string[] = [],
): Promise<AppliedDeal> {
  // 1. Check for duplicate application
  if (appliedDealIds.includes(dealId)) {
    throw new AppError('This deal has already been applied to this order', 400);
  }

  // 2. Load deal from DB
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) {
    throw new AppError('Deal not found', 404);
  }

  // 3. Check if deal is active
  if (!deal.isActive) {
    throw new AppError(`Deal "${deal.title}" is no longer active`, 400);
  }

  // 4. Check validity window
  const now = new Date();
  if (deal.validFrom > now) {
    throw new AppError(`Deal "${deal.title}" has not started yet`, 400);
  }
  if (deal.validTo && deal.validTo < now) {
    throw new AppError(`Deal "${deal.title}" has expired`, 400);
  }

  // 5. Check linked items are in the order
  const linkedItemIds = (deal.linkedItemIds as string[]) || [];
  if (linkedItemIds.length > 0) {
    // Verify all linked items exist in DB
    const existingItems = await prisma.menuItem.findMany({
      where: { id: { in: linkedItemIds }, deletedAt: null },
      select: { id: true },
    });
    const existingIds = new Set(existingItems.map((i) => i.id));
    const invalidLinked = linkedItemIds.filter((id) => !existingIds.has(id));
    if (invalidLinked.length > 0) {
      throw new AppError(`Deal "${deal.title}" references items that no longer exist`, 400);
    }

    // Verify all linked items are in the order
    const orderItemIds = new Set(orderItems.map((i) => i.menuItemId));
    const missing = linkedItemIds.filter((id) => !orderItemIds.has(id));
    if (missing.length > 0) {
      throw new AppError(
        `Deal "${deal.title}" requires specific items that are not in your order`,
        400,
      );
    }
  }

  // 6. Calculate discount
  let discountAmount = 0;
  if (deal.discountType === 'flat') {
    discountAmount = deal.discountValue;
  } else if (deal.discountType === 'percent') {
    discountAmount = Math.round((subtotal * deal.discountValue / 100) * 100) / 100;
  }

  // Don't let discount exceed subtotal
  discountAmount = Math.min(discountAmount, subtotal);

  return { dealId, discountAmount };
}

/**
 * Validate multiple deals applied to a single order.
 * Returns total discount amount.
 */
export async function validateDeals(
  dealIds: string[],
  orderItems: OrderItemInput[],
  subtotal: number,
): Promise<{ deals: AppliedDeal[]; totalDiscount: number }> {
  const deals: AppliedDeal[] = [];
  const appliedIds: string[] = [];
  let totalDiscount = 0;

  for (const dealId of dealIds) {
    const result = await validateDeal(dealId, orderItems, subtotal - totalDiscount, appliedIds);
    deals.push(result);
    appliedIds.push(dealId);
    totalDiscount += result.discountAmount;
  }

  // Total discount cannot exceed subtotal
  totalDiscount = Math.min(totalDiscount, subtotal);

  return { deals, totalDiscount };
}
