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
import { AppError } from '../middleware/errorHandler';

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
  paymentMethod: z.enum(['cash', 'safepay']).default('cash'),
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

    const { items, deliveryAddress, deliveryLat, deliveryLng, notes, paymentMethod } = parsed.data;

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
      const { lines, subtotal } = await validateAndPriceOrder(items);

      // 6. Apply fees
      const deliveryFee    = settings?.deliveryFee    ?? 0;
      const serviceCharge  = settings?.serviceCharge  ?? 0;
      const total          = subtotal + deliveryFee + serviceCharge;

      // 7. Load customer details
      const customer = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });
      if (!customer) throw new AppError('Customer not found', 404);

      // 8. Create order — paymentStatus depends on method:
      //    cash    → 'none'    (COD, kitchen sees it after /payments/create)
      //    safepay → 'pending' (kitchen does NOT see it until webhook fires)
      const order = await prisma.order.create({
        data: {
          orderNumber:   generateOrderNumber(),
          customerId:    req.user!.userId,
          deliveryAddress,
          deliveryLat,
          deliveryLng,
          notes,
          subtotal,
          deliveryFee,
          serviceCharge,
          total,
          status:        'pending',
          paymentMethod,
          paymentStatus: paymentMethod === 'cash' ? 'none' : 'pending',
          items: {
            create: lines.map((line) => ({
              menuItemId:        line.menuItemId,
              menuItemName:      line.menuItemName,
              quantity:          line.quantity,
              unitPrice:         line.unitPrice,
              totalPrice:        line.totalPrice,
              notes:             line.notes,
              selectedModifiers: line.selectedModifiers as any,
            })),
          },
        },
        include: { items: true, customer: true },
      });

      // 9. Return order — client must now call POST /api/payments/create
      //    with { orderId, paymentMethod } to complete checkout.
      //    That endpoint handles SSE broadcast + WhatsApp.
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
      } else {
        console.error('[Orders] Unexpected error:', err);
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
    const orders = await prisma.order.findMany({
      where: { customerId: req.user!.userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
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
