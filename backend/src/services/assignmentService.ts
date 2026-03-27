// ─────────────────────────────────────────────────────
//  ASSIGNMENT SERVICE  — Phase 7
//  Single source of truth for driver assignment.
//
//  Called by:
//    kitchen route  → auto-assign when order becomes 'ready'
//    admin route    → manual reassignment
//
//  Algorithm: least-busy AVAILABLE + VERIFIED driver.
//  Upgrade path: swap orderBy to Haversine distance later
//  without touching any callers.
// ─────────────────────────────────────────────────────

import { prisma }           from '../config/db';
import { sseManager }       from './sseManager';
import { applyStatusChange } from './orderLifecycle';

// ─── Auto-assignment ──────────────────────────────────
//  Called when kitchen marks order 'ready'.
//  Runs fire-and-forget — kitchen does not await it.

export async function assignDriver(orderId: string): Promise<void> {
  const driver = await prisma.staff.findFirst({
    where: {
      role:               'delivery',
      isActive:           true,
      driverStatus:       'AVAILABLE',
      verificationStatus: 'VERIFIED',
    },
    orderBy: { activeOrderCount: 'asc' },
  });

  if (!driver) {
    sseManager.broadcastToAdmin('NO_DRIVER_AVAILABLE', {
      orderId,
      message: 'No available driver. Please assign manually.',
    });
    return;
  }

  // applyStatusChange writes the DB update, fires SSE to specific driver, fires WhatsApp
  await applyStatusChange(orderId, 'assigned', 'system', { driverId: driver.id });

  // Increment counts AFTER successful assignment
  await prisma.staff.update({
    where: { id: driver.id },
    data:  {
      driverStatus:     'ON_DELIVERY',
      activeOrderCount: { increment: 1 },
    },
  });

  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: {
      items:    { select: { menuItemName: true, quantity: true } },
      customer: { select: { name: true } },
    },
  });

  sseManager.sendToDriver(driver.id, 'NEW_DELIVERY_ASSIGNED', {
    orderId,
    orderNumber:     order?.orderNumber,
    deliveryAddress: order?.deliveryAddress,
    total:           order?.total,
    customerName:    order?.customer?.name ?? 'Counter Order',
    items:           order?.items ?? [],
  });

  sseManager.broadcastToAdmin('DRIVER_ASSIGNED', {
    orderId,
    orderNumber: order?.orderNumber,
    driverId:    driver.id,
    driverName:  driver.fullName ?? driver.username,
  });
}

// ─── Manual assignment (admin) ────────────────────────

export async function manuallyAssignDriver(
  orderId:  string,
  driverId: string,
): Promise<void> {
  const [driver, order] = await Promise.all([
    prisma.staff.findUnique({ where: { id: driverId } }),
    prisma.order.findUnique({
      where:   { id: orderId },
      include: { items: { select: { menuItemName: true, quantity: true } } },
    }),
  ]);

  if (!driver)                                    throw new Error('Driver not found');
  if (!order)                                     throw new Error('Order not found');
  if (driver.role !== 'delivery')                 throw new Error('Staff is not a driver');
  if (!driver.isActive)                           throw new Error('Driver is not active');
  if (driver.verificationStatus !== 'VERIFIED')   throw new Error('Driver is not verified');

  // Release previous driver if reassigning
  if (order.driverId && order.driverId !== driverId) {
    await prisma.staff.update({
      where: { id: order.driverId },
      data:  { activeOrderCount: { decrement: 1 }, driverStatus: 'AVAILABLE' },
    });
  }

  await applyStatusChange(orderId, 'assigned', 'system', { driverId });

  await prisma.staff.update({
    where: { id: driverId },
    data:  { driverStatus: 'ON_DELIVERY', activeOrderCount: { increment: 1 } },
  });

  sseManager.sendToDriver(driverId, 'NEW_DELIVERY_ASSIGNED', {
    orderId,
    orderNumber:     order.orderNumber,
    deliveryAddress: order.deliveryAddress,
    total:           order.total,
    items:           order.items ?? [],
    message:         'Order assigned by admin',
  });

  sseManager.broadcastToAdmin('DRIVER_ASSIGNED', {
    orderId,
    driverId,
    driverName: driver.fullName ?? driver.username,
    manual:     true,
  });
}
