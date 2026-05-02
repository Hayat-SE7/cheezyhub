// ─────────────────────────────────────────────────────
//  TIMEOUT SERVICE
//  Periodic cleanup of stale pending payments and orders.
//
//  - Pending Safepay payments older than PAYMENT_TIMEOUT_MINUTES → cancelled
//  - Pending orders (no payment created) older than ORDER_TIMEOUT_MINUTES → cancelled
//  - Dangling open shifts older than SHIFT_TIMEOUT_HOURS → auto-closed
// ─────────────────────────────────────────────────────

import { prisma } from '../config/db';
import { sseManager } from './sseManager';
import { logger } from '../config/logger';

const PAYMENT_TIMEOUT_MINUTES = parseInt(process.env.PAYMENT_TIMEOUT_MINUTES ?? '30');
const ORDER_TIMEOUT_MINUTES   = parseInt(process.env.ORDER_TIMEOUT_MINUTES ?? '15');
const SHIFT_TIMEOUT_HOURS     = parseInt(process.env.SHIFT_TIMEOUT_HOURS ?? '12');
const CHECK_INTERVAL_MS       = 60_000; // check every minute

// ─── Timeout stale pending payments ──────────────────

async function expirePendingPayments(): Promise<void> {
  const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60_000);

  const staleOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'pending',
      paymentMethod: 'safepay',
      status: 'pending',
      createdAt: { lt: cutoff },
    },
    select: { id: true, orderNumber: true, customerId: true },
  });

  for (const order of staleOrders) {
    try {
      await prisma.$transaction([
        prisma.payment.updateMany({
          where: { orderId: order.id, status: 'pending' },
          data: { status: 'failed' },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'failed', status: 'cancelled' },
        }),
      ]);

      if (order.customerId) {
        sseManager.sendToCustomer(order.customerId, 'PAYMENT_FAILED', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: 'Payment timed out',
        });
      }

      logger.info({ orderNumber: order.orderNumber }, 'Payment timed out — order cancelled');
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'Failed to expire payment');
    }
  }
}

// ─── Timeout stale pending orders (no payment) ──────

async function expirePendingOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - ORDER_TIMEOUT_MINUTES * 60_000);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: 'pending',
      paymentStatus: 'none',
      createdAt: { lt: cutoff },
    },
    select: { id: true, orderNumber: true, customerId: true },
  });

  for (const order of staleOrders) {
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'cancelled' },
      });

      if (order.customerId) {
        sseManager.sendToCustomer(order.customerId, 'ORDER_UPDATED', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: 'cancelled',
          reason: 'Order timed out — no payment received',
        });
      }

      logger.info({ orderNumber: order.orderNumber }, 'Order timed out — cancelled');
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'Failed to expire order');
    }
  }
}

// ─── Timeout dangling open shifts ────────────────────

async function expireDanglingShifts(): Promise<void> {
  const cutoff = new Date(Date.now() - SHIFT_TIMEOUT_HOURS * 3600_000);

  const staleShifts = await prisma.shift.findMany({
    where: {
      status: 'open',
      startedAt: { lt: cutoff },
    },
    select: { id: true, cashierId: true, totalSales: true, orderCount: true },
  });

  for (const shift of staleShifts) {
    try {
      await prisma.shift.update({
        where: { id: shift.id },
        data: {
          status: 'closed',
          endedAt: new Date(),
          notes: `Auto-closed after ${SHIFT_TIMEOUT_HOURS}h timeout`,
        },
      });
      logger.info({ shiftId: shift.id }, 'Dangling shift auto-closed');
    } catch (err) {
      logger.error({ err, shiftId: shift.id }, 'Failed to auto-close shift');
    }
  }
}

// ─── Start the periodic check ────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startTimeoutService(): void {
  if (intervalHandle) return;

  logger.info(
    `Timeout service started (payment: ${PAYMENT_TIMEOUT_MINUTES}m, order: ${ORDER_TIMEOUT_MINUTES}m, shift: ${SHIFT_TIMEOUT_HOURS}h)`
  );

  intervalHandle = setInterval(async () => {
    try {
      await Promise.all([
        expirePendingPayments(),
        expirePendingOrders(),
        expireDanglingShifts(),
      ]);
    } catch (err) {
      logger.error({ err }, 'Timeout service tick failed');
    }
  }, CHECK_INTERVAL_MS);
}

export function stopTimeoutService(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
