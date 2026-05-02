// ─────────────────────────────────────────────────────
//  ORDERS ROUTE
//  Handles order placement with:
//    ✅ Auth guard (customers only)
//    ✅ Orders-paused check
//    ✅ Delivery radius validation
//    ✅ Full inventory validation (items + modifiers)
//    ✅ Price calculation
//    ✅ SSE broadcast
//    ✅ WhatsApp ORDER_CONFIRMED
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateAndPriceOrder } from '../services/inventoryService';
import { checkDeliveryRadius, isRadiusConfigured } from '../services/radiusService';
import { validateDeals } from '../services/dealsService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export const orderRouter = Router();

// All order routes require login
orderRouter.use(authenticate);

// ─── Helper ──────────────────────────────────────────

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CH-${ts}${rand}`;
}

// ─── Validation Schema ────────────────────────────────

const placeOrderSchema = z.object({
  idempotencyKey: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1, 'Item ID required'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        selectedModifierIds: z.array(z.string()).default([]),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1, 'Order must have at least one item'),
  deliveryAddress: z.string().min(5, 'Please provide a full delivery address'),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  notes: z.string().max(500).optional(),
  dealIds: z.array(z.string()).default([]),
});

// ─── POST /api/orders ─────────────────────────────────
//     Place a new order (customers only)

orderRouter.post(
  '/',
  requireRole('customer'),
  async (req: AuthenticatedRequest, res: Response) => {
    // 1. Validate request body
    const parsed = placeOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? 'Invalid order data';
      res.status(400).json({ success: false, error: firstError });
      return;
    }

    const { idempotencyKey, items, deliveryAddress, deliveryLat, deliveryLng, notes, dealIds } = parsed.data;

    try {
      // 2. Load system settings
      const settings = await prisma.systemSettings.findFirst();

      // 3. Check if orders are accepting
      if (settings && !settings.ordersAccepting) {
        throw new AppError(
          'We are not accepting orders right now. Please try again soon.',
          503
        );
      }

      // 4. Delivery radius check (only if restaurant coordinates are configured)
      if (
        deliveryLat !== undefined &&
        deliveryLng !== undefined &&
        settings &&
        isRadiusConfigured(settings.restaurantLat, settings.restaurantLng)
      ) {
        const { allowed, distanceKm } = checkDeliveryRadius(
          deliveryLat,
          deliveryLng,
          settings.restaurantLat,
          settings.restaurantLng,
          settings.deliveryRadiusKm
        );

        if (!allowed) {
          throw new AppError(
            `Sorry, we don't deliver to your area. You are ${distanceKm} km away (max ${settings.deliveryRadiusKm} km).`,
            400
          );
        }
      }

      // 5. Validate inventory + calculate prices
      //    This throws descriptive errors if anything is unavailable
      const { lines, subtotal } = await validateAndPriceOrder(items as any);

      // 6. Validate and apply deals (server-side enforcement)
      let dealDiscount = 0;
      let appliedDeals: { dealId: string; discountAmount: number }[] = [];
      if (dealIds.length > 0) {
        const dealResult = await validateDeals(dealIds, items as any, subtotal);
        dealDiscount = dealResult.totalDiscount;
        appliedDeals = dealResult.deals;
      }

      // 7. Apply fees (waive delivery if subtotal meets free-delivery threshold)
      const rawFee = settings?.deliveryFee ?? 0;
      const threshold = settings?.freeDeliveryThreshold ?? 0;
      const deliveryFee = threshold > 0 && subtotal >= threshold ? 0 : rawFee;
      const serviceCharge = settings?.serviceCharge ?? 0;
      const total = subtotal - dealDiscount + deliveryFee + serviceCharge;

      // 7. Load customer details
      const customer = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, name: true, mobile: true },
      });
      if (!customer) throw new AppError('Customer not found', 404);

      // 8. Create order atomically with idempotency check inside transaction
      const order = await prisma.$transaction(async (tx) => {
        // Idempotency check inside transaction to prevent race condition
        if (idempotencyKey) {
          const existing = await tx.order.findFirst({
            where: { idempotencyKey, customerId: req.user!.userId },
            select: { id: true, orderNumber: true },
          });
          if (existing) {
            return { _duplicate: true as const, ...existing };
          }
        }

        return tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            orderType: 'delivery',
            customerId: req.user!.userId,
            idempotencyKey: idempotencyKey ?? null,
            deliveryAddress,
            deliveryLat,
            deliveryLng,
            notes,
            subtotal,
            dealDiscount,
            appliedDeals: appliedDeals as any,
            deliveryFee,
            serviceCharge,
            total,
            status: 'pending',
            items: {
              create: lines.map((line) => ({
                menuItemId: line.menuItemId,
                menuItemName: line.menuItemName,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                totalPrice: line.totalPrice,
                notes: line.notes,
                selectedModifiers: line.selectedModifiers as any,
              })),
            },
          },
          include: {
            items: true,
            customer: { select: { id: true, name: true, mobile: true } }
          },
        });
      });

      if ('_duplicate' in order) {
        res.status(409).json({ success: false, error: 'Duplicate order', data: { id: order.id, orderNumber: order.orderNumber } });
        return;
      }

      // NOTE: Do NOT broadcast ORDER_CREATED or send WhatsApp here.
      // The payments route handles broadcasting after payment is confirmed
      // (instant for COD, after webhook for Safepay). This prevents the
      // kitchen from seeing orders that haven't been paid for yet.

      res.status(201).json({ success: true, data: order });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
      } else {
        logger.error({ err }, 'Order placement failed');
        res.status(500).json({ success: false, error: 'Failed to place order' });
      }
    }
  }
);

// ─── GET /api/orders ──────────────────────────────────
//     Get own order history (customers)

orderRouter.get(
  '/',
  requireRole('customer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip  = (page - 1) * limit;

    const where = { customerId: req.user!.userId };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ success: true, data: { items: orders, total, page, limit, totalPages: Math.ceil(total / limit) } });
  }
);

// ─── GET /api/orders/:id ──────────────────────────────
//     Get a single order (customer sees own, staff sees all)

orderRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: true,
      driver: { select: { id: true, username: true } },
      customer: { select: { id: true, name: true, mobile: true } },
    },
  });

  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  // Customers can only view their own orders
  if (req.user!.role === 'customer' && order.customerId !== req.user!.userId) {
    res.status(403).json({ success: false, error: 'You can only view your own orders' });
    return;
  }

  res.json({ success: true, data: order });
});
