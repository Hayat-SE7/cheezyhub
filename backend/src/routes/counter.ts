// ─────────────────────────────────────────────────────────────────
//  COUNTER ROUTE — Phase 12 (Offline POS rebuild)
//  ✅ All original Phase 1 endpoints preserved
//  ✅ NEW: POST /counter/sync           — batch offline order replay
//  ✅ NEW: POST /counter/menu/invalidate — cache bust SSE broadcast
// ─────────────────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateAndPriceOrder } from '../services/inventoryService';
import { sseManager } from '../services/sseManager';
import { AppError } from '../middleware/errorHandler';

export const counterRouter = Router();
counterRouter.use(authenticate, requireRole('cashier', 'admin'));

// ─── Helpers ─────────────────────────────────────────────────────

function generateOrderNumber(): string {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `CH-${ts}${rand}`;
}

const MENU_INCLUDE = {
  where:   { deletedAt: null as null },
  orderBy: { sortOrder: 'asc' as const },
  include: {
    items: {
      where:   { isAvailable: true, deletedAt: null as null },
      orderBy: { sortOrder: 'asc' as const },
      include: {
        modifierGroups: {
          orderBy: { sortOrder: 'asc' as const },
          include: {
            modifiers: {
              where:   { isAvailable: true },
              orderBy: { sortOrder: 'asc' as const },
            },
          },
        },
      },
    },
  },
};

// ─── GET /counter/menu ────────────────────────────────────────────
counterRouter.get('/menu', async (_req: AuthenticatedRequest, res: Response) => {
  const categories = await prisma.category.findMany(MENU_INCLUDE);
  res.json({ success: true, data: categories });
});

// ─── POST /counter/menu/invalidate ───────────────────────────────
counterRouter.post('/menu/invalidate', async (_req: AuthenticatedRequest, res: Response) => {
  sseManager.broadcastToCounter('menu_updated', { timestamp: Date.now() });
  res.json({ success: true, message: 'Menu cache invalidated — counter SSE clients notified' });
});

// ─── POST /counter/orders ─────────────────────────────────────────
const counterOrderSchema = z.object({
  items: z.array(z.object({
    menuItemId:          z.string().min(1),
    quantity:            z.number().int().min(1),
    selectedModifierIds: z.array(z.string()).default([]),
    notes:               z.string().max(200).optional(),
  })).min(1),
  customerNote:     z.string().max(500).optional(),
  paymentMethod:    z.enum(['cash', 'card']).default('cash'),
  offlineSync:      z.boolean().optional(),
  offlineCreatedAt: z.string().optional(),
});

counterRouter.post('/orders', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = counterOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message ?? 'Invalid data' });
    return;
  }

  const { items, customerNote, paymentMethod, offlineSync, offlineCreatedAt } = parsed.data;
  const cashierId = req.user!.userId;

  try {
    const { lines, subtotal } = await validateAndPriceOrder(items as any);
    const total = subtotal;

    const activeShift = await prisma.shift.findFirst({
      where: { cashierId, status: 'open' },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeShift) {
      res.status(400).json({ success: false, error: 'No active shift. Start a shift first.' });
      return;
    }

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber:      generateOrderNumber(),
          orderType:        'counter',
          status:           'pending',
          paymentMethod,
          paymentStatus:    'paid',
          subtotal,
          deliveryFee:      0,
          serviceCharge:    0,
          total,
          deliveryAddress:  'Counter',
          notes:            customerNote,
          cashierId,
          shiftId:          activeShift.id,
          offlineSync:      offlineSync ?? false,
          offlineCreatedAt: offlineCreatedAt ? new Date(offlineCreatedAt) : null,
          items: {
            create: lines.map((line) => ({
              menuItemId:        line.menuItemId,
              menuItemName:      line.menuItemName,
              quantity:          line.quantity,
              unitPrice:         line.unitPrice,
              totalPrice:        line.totalPrice,
              notes:             line.notes,
              selectedModifiers: line.selectedModifiers,
            })),
          },
        },
        include: { items: true },
      });

      await tx.ledgerEntry.create({
        data: {
          orderId:    newOrder.id,
          cashierId,
          shiftId:    activeShift.id,
          amount:     total,
          method:     paymentMethod,
          cashAmount: paymentMethod === 'cash' ? total : null,
          cardAmount: paymentMethod === 'card' ? total : null,
        },
      });

      await tx.shift.update({
        where: { id: activeShift.id },
        data: { orderCount: { increment: 1 }, totalSales: { increment: total } },
      });

      return newOrder;
    });

    if (!order) return; // guard for TS after early return above

    sseManager.broadcastToKitchen('new_order', {
      orderId: order.id, orderNumber: order.orderNumber,
      orderType: 'counter', items: order.items, total: order.total,
    });
    sseManager.broadcastToAdmin('new_order', {
      orderId: order.id, orderNumber: order.orderNumber, orderType: 'counter', total: order.total,
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    if (err instanceof AppError) res.status(err.statusCode).json({ success: false, error: err.message });
    else { console.error('[counter/orders]', err); res.status(500).json({ success: false, error: 'Failed to place order' }); }
  }
});

// ─── GET /counter/orders ──────────────────────────────────────────
counterRouter.get('/orders', async (_req: AuthenticatedRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const orders = await prisma.order.findMany({
    where: { orderType: 'counter', createdAt: { gte: today } },
    include: { items: true, cashier: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: orders });
});

// ─── POST /counter/ledger ─────────────────────────────────────────
const ledgerSchema = z.object({
  orderId:    z.string(),
  method:     z.enum(['cash', 'card', 'split']),
  amount:     z.number().positive(),
  cashAmount: z.number().optional(),
  cardAmount: z.number().optional(),
  notes:      z.string().optional(),
});

counterRouter.post('/ledger', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = ledgerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  const cashierId = req.user!.userId;
  const activeShift = await prisma.shift.findFirst({
    where: { cashierId, status: 'open' }, orderBy: { startedAt: 'desc' },
  });
  const entry = await prisma.ledgerEntry.upsert({
    where:  { orderId: parsed.data.orderId },
    update: { ...parsed.data, cashierId, shiftId: activeShift?.id } as any,
    create: { ...parsed.data, cashierId, shiftId: activeShift?.id } as any,
  });
  res.json({ success: true, data: entry });
});

// ─── Shift endpoints ──────────────────────────────────────────────
counterRouter.get('/shift/current', async (req: AuthenticatedRequest, res: Response) => {
  const cashierId = req.user!.userId;
  const shift = await prisma.shift.findFirst({
    where: { cashierId, status: 'open' }, orderBy: { startedAt: 'desc' },
    include: { cashier: { select: { username: true } } },
  });
  res.json({ success: true, data: shift ?? null });
});

counterRouter.post('/shift/start', async (req: AuthenticatedRequest, res: Response) => {
  const cashierId = req.user!.userId;
  const existing = await prisma.shift.findFirst({ where: { cashierId, status: 'open' } });
  if (existing) {
    res.status(409).json({ success: false, error: 'You already have an open shift. Close it first.' });
    return;
  }
  const shift = await prisma.shift.create({
    data: { cashierId, openingFloat: Number(req.body.openingFloat ?? 0), status: 'open' },
  });
  res.status(201).json({ success: true, data: shift });
});

counterRouter.post('/shift/end', async (req: AuthenticatedRequest, res: Response) => {
  const { closingCash, notes } = req.body;
  if (closingCash === undefined) {
    res.status(400).json({ success: false, error: 'closingCash is required' });
    return;
  }
  const cashierId = req.user!.userId;
  const shift = await prisma.shift.findFirst({ where: { cashierId, status: 'open' }, orderBy: { startedAt: 'desc' } });
  if (!shift) {
    res.status(404).json({ success: false, error: 'No open shift found' });
    return;
  }
  const cashSales = await prisma.ledgerEntry.aggregate({
    where: { shiftId: shift.id, method: 'cash' }, _sum: { cashAmount: true },
  });
  const expectedCash = shift.openingFloat + (cashSales._sum.cashAmount ?? 0);
  const discrepancy  = Number(closingCash) - expectedCash;
  const closed = await prisma.shift.update({
    where: { id: shift.id },
    data: { status: 'closed', endedAt: new Date(), closingCash: Number(closingCash), expectedCash, discrepancy, notes },
  });
  res.json({ success: true, data: closed });
});

// ─── POST /counter/sync ───────────────────────────────────────────
//  Phase 12: Batch replay of offline-queued orders.
//  Each item has an idempotencyKey → prevents double-posting if
//  the client retries after a network hiccup mid-sync.
// ─────────────────────────────────────────────────────────────────

const syncItemSchema = z.object({
  idempotencyKey:   z.string().min(1),
  offlineCreatedAt: z.string(),
  paymentMethod:    z.enum(['cash', 'card']).default('cash'),
  customerNote:     z.string().max(500).optional(),
  items: z.array(z.object({
    menuItemId:          z.string(),
    quantity:            z.number().int().min(1),
    selectedModifierIds: z.array(z.string()).default([]),
    notes:               z.string().optional(),
  })).min(1),
});

const syncBatchSchema = z.object({
  orders: z.array(syncItemSchema).min(1).max(50),
});

counterRouter.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = syncBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const cashierId = req.user!.userId;
  const results: {
    idempotencyKey: string;
    status: 'created' | 'duplicate' | 'failed';
    orderId?: string;
    error?: string;
  }[] = [];

  for (const item of parsed.data.orders) {
    // Idempotency check
    const existing = await prisma.offlineSyncLog.findUnique({
      where: { idempotencyKey: item.idempotencyKey },
    }).catch((): null => null);

    if (existing) {
      results.push({ idempotencyKey: item.idempotencyKey, status: 'duplicate', orderId: existing.orderId ?? undefined });
      continue;
    }

    try {
      const { lines, subtotal } = await validateAndPriceOrder(item.items as any);
      const total = subtotal;

      const activeShift = await prisma.shift.findFirst({
        where: { cashierId, status: 'open' }, orderBy: { startedAt: 'desc' },
      });

      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            orderNumber:      generateOrderNumber(),
            orderType:        'counter',
            status:           'pending',
            paymentMethod:    item.paymentMethod,
            paymentStatus:    'paid',
            subtotal,
            deliveryFee:      0,
            serviceCharge:    0,
            total,
            deliveryAddress:  'Counter',
            notes:            item.customerNote,
            cashierId,
            shiftId:          activeShift?.id ?? null,
            offlineSync:      true,
            offlineCreatedAt: new Date(item.offlineCreatedAt),
            items: {
              create: lines.map((line) => ({
                menuItemId:        line.menuItemId,
                menuItemName:      line.menuItemName,
                quantity:          line.quantity,
                unitPrice:         line.unitPrice,
                totalPrice:        line.totalPrice,
                notes:             line.notes,
                selectedModifiers: line.selectedModifiers,
              })),
            },
          },
          include: { items: true },
        });

        await tx.ledgerEntry.create({
          data: {
            orderId:    newOrder.id,
            cashierId,
            shiftId:    activeShift?.id ?? null,
            amount:     total,
            method:     item.paymentMethod,
            cashAmount: item.paymentMethod === 'cash' ? total : null,
            cardAmount: item.paymentMethod === 'card' ? total : null,
          },
        });

        if (activeShift) {
          await tx.shift.update({
            where: { id: activeShift.id },
            data: { orderCount: { increment: 1 }, totalSales: { increment: total } },
          });
        }

        await tx.offlineSyncLog.create({
          data: { idempotencyKey: item.idempotencyKey, orderId: newOrder.id, cashierId, status: 'success' },
        });

        return newOrder;
      });

      sseManager.broadcastToKitchen('new_order', {
        orderId: order.id, orderNumber: order.orderNumber,
        orderType: 'counter', items: order.items, total: order.total,
      });
      sseManager.broadcastToAdmin('new_order', {
        orderId: order.id, orderNumber: order.orderNumber, orderType: 'counter', total: order.total,
      });

      results.push({ idempotencyKey: item.idempotencyKey, status: 'created', orderId: order.id });
    } catch (err: any) {
      await prisma.offlineSyncLog.create({
        data: {
          idempotencyKey: item.idempotencyKey, cashierId, status: 'failed',
          errorMessage: err instanceof AppError ? err.message : 'Server error',
        },
      }).catch(() => {});

      results.push({
        idempotencyKey: item.idempotencyKey,
        status: 'failed',
        error: err instanceof AppError ? err.message : 'Server error',
      });
    }
  }

  const created    = results.filter((r) => r.status === 'created').length;
  const duplicates = results.filter((r) => r.status === 'duplicate').length;
  const failed     = results.filter((r) => r.status === 'failed').length;

  if (created > 0) {
    sseManager.broadcastToCounter('sync_complete', { created, duplicates, failed, timestamp: Date.now() });
  }

  res.json({ success: true, data: { results, summary: { created, duplicates, failed } } });
});
