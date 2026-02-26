// ─────────────────────────────────────────────────────
//  DELIVERY ROUTE
//  Handles:
//    ✅ Driver's active orders list
//    ✅ Status: assigned → picked_up → delivered (auto-completes)
//    ✅ Ownership check (driver can only update their own orders)
//    ✅ Google Maps redirect URL generation
//    ✅ WhatsApp OUT_FOR_DELIVERY on picked_up
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { applyStatusChange } from '../services/orderLifecycle';
import { AppError } from '../middleware/errorHandler';
import { OrderStatus } from '@prisma/client';

export const deliveryRouter = Router();

// All delivery routes require delivery or admin role
deliveryRouter.use(authenticate, requireRole('delivery', 'admin'));

// ─── GET /api/delivery/orders ─────────────────────────
//     This driver's active assignments (assigned + picked_up)

deliveryRouter.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  const orders = await prisma.order.findMany({
    where: {
      driverId: req.user!.userId,
      status: { in: ['assigned', 'picked_up'] },
    },
    include: {
      items: { select: { menuItemName: true, quantity: true } },
      customer: { select: { id: true, name: true, mobile: true } },
    },
    orderBy: { updatedAt: 'asc' },
  });
  res.json({ success: true, data: orders });
});

// ─── GET /api/delivery/orders/history ─────────────────
//     This driver's completed deliveries today

deliveryRouter.get('/orders/history', async (req: AuthenticatedRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: {
      driverId: req.user!.userId,
      status: 'completed',
      updatedAt: { gte: today },
    },
    include: { items: { select: { menuItemName: true, quantity: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ success: true, data: orders });
});

// ─── PATCH /api/delivery/orders/:id/status ─────────────
//     Driver updates: assigned → picked_up → delivered
//     On "delivered", system auto-transitions to "completed"

deliveryRouter.patch(
  '/orders/:id/status',
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ success: false, error: 'Status is required' });
      return;
    }

    try {
      // Load order to verify ownership
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) throw new AppError('Order not found', 404);

      // Ownership check: drivers can only update THEIR assigned orders
      // Admins can update any order
      if (req.user!.role === 'delivery' && order.driverId !== req.user!.userId) {
        throw new AppError('This order is not assigned to you', 403);
      }

      // Apply transition via lifecycle engine
      // Engine handles SSE broadcasts + WhatsApp notifications + auto-complete
      const updated = await applyStatusChange(id, status as OrderStatus, req.user!.role);

      res.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
      } else {
        console.error('[Delivery] Error:', err);
        res.status(500).json({ success: false, error: 'Failed to update delivery status' });
      }
    }
  }
);

// ─── GET /api/delivery/orders/:id/maps ────────────────
//     Returns a Google Maps URL for the delivery address
//     Driver app opens this to navigate

deliveryRouter.get(
  '/orders/:id/maps',
  async (req: AuthenticatedRequest, res: Response) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { driverId: true, deliveryLat: true, deliveryLng: true, deliveryAddress: true },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    if (req.user!.role === 'delivery' && order.driverId !== req.user!.userId) {
      res.status(403).json({ success: false, error: 'Not your order' });
      return;
    }

    // Build Google Maps URL
    const query = order.deliveryLat
      ? `${order.deliveryLat},${order.deliveryLng}`
      : encodeURIComponent(order.deliveryAddress);

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`;

    res.json({ success: true, data: { mapsUrl } });
  }
);

