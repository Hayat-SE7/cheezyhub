// ─────────────────────────────────────────────────────
//  ASSIGNMENT SERVICE  — Phase 7
//  Single source of truth for driver assignment.
//
//  Called by:
//    kitchen route  → auto-assign when order becomes 'ready'
//    admin route    → manual reassignment
//
//  Algorithm: nearest AVAILABLE + VERIFIED driver by Haversine distance.
//  Falls back to least-busy if order has no GPS coordinates or
//  no drivers have live location data.
// ─────────────────────────────────────────────────────

import { prisma }           from '../config/db';
import { sseManager }       from './sseManager';
import { applyStatusChange } from './orderLifecycle';
import { haversineKm }      from './radiusService';

// ─── Auto-assignment ──────────────────────────────────
//  Called when kitchen marks order 'ready'.
//  Runs fire-and-forget — kitchen does not await it.

export async function assignDriver(orderId: string): Promise<void> {
  // 1. Transaction: atomically pick the best driver and reserve them.
  const result = await prisma.$transaction(async (tx) => {
    // Load order coordinates for distance-based assignment
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { deliveryLat: true, deliveryLng: true },
    });

    const candidates = await tx.staff.findMany({
      where: {
        role:               'delivery',
        isActive:           true,
        driverStatus:       'AVAILABLE',
        verificationStatus: 'VERIFIED',
      },
    });

    if (candidates.length === 0) return null;

    // Pick best driver: use Haversine distance if order has GPS coords,
    // otherwise fall back to least-busy (fewest active orders)
    let driver;
    if (order?.deliveryLat && order?.deliveryLng) {
      driver = candidates
        .map((d) => ({
          ...d,
          distance: d.liveLat != null && d.liveLng != null
            ? haversineKm(d.liveLat!, d.liveLng!, order.deliveryLat!, order.deliveryLng!)
            : Infinity,
        }))
        .sort((a, b) => a.distance - b.distance || a.activeOrderCount - b.activeOrderCount)[0];
    } else {
      driver = candidates.sort((a, b) => a.activeOrderCount - b.activeOrderCount)[0];
    }

    if (!driver) return null;

    // Reserve the driver inside the transaction
    await tx.staff.update({
      where: { id: driver.id },
      data:  {
        driverStatus:     'ON_DELIVERY',
        activeOrderCount: { increment: 1 },
      },
    });

    return { driver };
  });

  if (!result) {
    sseManager.broadcastToAdmin('NO_DRIVER_AVAILABLE', {
      orderId,
      message: 'No available driver. Please assign manually.',
    });
    return;
  }

  const { driver } = result;

  // 2. Apply the order status change outside the transaction.
  //    If this fails, release the driver reservation.
  try {
    await applyStatusChange(orderId, 'assigned', 'system', { driverId: driver.id });
  } catch (err) {
    // Rollback driver reservation
    await prisma.staff.update({
      where: { id: driver.id },
      data:  { driverStatus: 'AVAILABLE', activeOrderCount: { decrement: 1 } },
    }).catch(() => {});
    throw err;
  }

  // 3. Load order details for SSE notifications
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: {
      items:    { select: { menuItemName: true, quantity: true } },
      customer: { select: { name: true } },
    },
  });

  // SSE notifications (non-critical, fire-and-forget)
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

// ─── Retry stuck 'ready' orders after a driver becomes available ──────────────
//  Called whenever a driver transitions to AVAILABLE (delivery completed or
//  manual status toggle).  Finds every delivery order stuck in 'ready' with
//  no driver and attempts auto-assignment one by one.  Because assignDriver()
//  atomically reserves the first available driver, subsequent calls will fail
//  gracefully with NO_DRIVER_AVAILABLE once the newly-freed driver is taken.

export async function retryPendingAssignments(): Promise<void> {
  const stuckOrders = await prisma.order.findMany({
    where: {
      status:    'ready',
      orderType: 'delivery',
      driverId:  null,
    },
    select:  { id: true },
    orderBy: { createdAt: 'asc' }, // oldest first
  });

  if (stuckOrders.length === 0) return;

  for (const { id } of stuckOrders) {
    await assignDriver(id).catch((err) => {
      console.error('[retryPendingAssignments] Assignment failed for order', id, err);
    });
  }
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
