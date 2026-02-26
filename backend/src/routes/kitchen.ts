// ─────────────────────────────────────────────────────
//  KITCHEN ROUTE
//  Handles:
//    ✅ Live order queue (pending → preparing → ready)
//    ✅ Status transitions via lifecycle engine
//    ✅ Inventory control (items + modifiers)
//    ✅ Orders pause toggle
//    ✅ Order history
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { sseManager } from '../services/sseManager';
import { applyStatusChange } from '../services/orderLifecycle';
import { setItemAvailability, setModifierAvailability } from '../services/inventoryService';
import { AppError } from '../middleware/errorHandler';
import { OrderStatus } from '@prisma/client';

export const kitchenRouter = Router();

// All kitchen routes require kitchen or admin role
kitchenRouter.use(authenticate, requireRole('kitchen', 'admin'));

// ─── GET /api/kitchen/orders ──────────────────────────
//     Live queue: only pending, preparing, ready orders

kitchenRouter.get('/orders', async (_req: AuthenticatedRequest, res: Response) => {
  const orders = await prisma.order.findMany({
    where: { status: { in: ['pending', 'preparing', 'ready'] } },
    include: {
      items: true,
      customer: { select: { id: true, name: true, mobile: true } },
    },
    orderBy: { createdAt: 'asc' }, // oldest first (FIFO)
  });
  res.json({ success: true, data: orders });
});

// ─── GET /api/kitchen/orders/history ─────────────────
//     Completed orders (for review)

kitchenRouter.get('/orders/history', async (_req: AuthenticatedRequest, res: Response) => {
  const orders = await prisma.order.findMany({
    where: { status: { in: ['completed', 'cancelled'] } },
    include: { items: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: orders });
});

// ─── PATCH /api/kitchen/orders/:id/status ─────────────
//     Kitchen can only move: pending→preparing, preparing→ready
//     (or cancel either). Lifecycle engine enforces this.

kitchenRouter.patch(
  '/orders/:id/status',
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ success: false, error: 'Status is required' });
      return;
    }

    try {
      // applyStatusChange validates role, fires SSE, fires WhatsApp
      const updated = await applyStatusChange(id, status as OrderStatus, req.user!.role);
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
      } else {
        res.status(500).json({ success: false, error: 'Failed to update status' });
      }
    }
  }
);

// ─── PATCH /api/kitchen/inventory/items/:id ───────────
//     Toggle entire menu item availability

kitchenRouter.patch(
  '/inventory/items/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      res.status(400).json({ success: false, error: 'isAvailable (boolean) required' });
      return;
    }

    await setItemAvailability(id, isAvailable);

    // Broadcast to all connected customers (menu updates in real-time)
    sseManager.broadcastAll('ITEM_AVAILABILITY', { itemId: id, isAvailable });

    res.json({
      success: true,
      message: `Item ${isAvailable ? 'enabled' : 'disabled'}`,
      data: { itemId: id, isAvailable },
    });
  }
);

// ─── PATCH /api/kitchen/inventory/modifiers/:id ───────
//     Toggle a single modifier availability
//     Example: "disable Cheese" while pizza is still available

kitchenRouter.patch(
  '/inventory/modifiers/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      res.status(400).json({ success: false, error: 'isAvailable (boolean) required' });
      return;
    }

    await setModifierAvailability(id, isAvailable);

    // Broadcast to customers so modifier shows as unavailable instantly
    sseManager.broadcastAll('MODIFIER_AVAILABILITY', { modifierId: id, isAvailable });

    res.json({
      success: true,
      message: `Modifier ${isAvailable ? 'enabled' : 'disabled'}`,
      data: { modifierId: id, isAvailable },
    });
  }
);

// ─── PATCH /api/kitchen/pause ─────────────────────────
//     Toggle whether new orders are accepted

kitchenRouter.patch('/pause', async (req: AuthenticatedRequest, res: Response) => {
  const { paused } = req.body;

  if (typeof paused !== 'boolean') {
    res.status(400).json({ success: false, error: 'paused (boolean) required' });
    return;
  }

  const settings = await prisma.systemSettings.findFirst();

  if (settings) {
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: { ordersAccepting: !paused },
    });
  } else {
    await prisma.systemSettings.create({
      data: { ordersAccepting: !paused },
    });
  }

  // Broadcast to all (customer menu will show pause banner)
  sseManager.broadcastAll('ORDERS_PAUSED', { paused });

  res.json({ success: true, data: { paused } });
});
