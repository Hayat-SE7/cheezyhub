// ─────────────────────────────────────────────────────
//  ORDER LIFECYCLE ENGINE
//  Single source of truth for all order state transitions.
//  Every status change in the system goes through here.
// ─────────────────────────────────────────────────────

import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { sseManager } from './sseManager';
import { whatsappService } from './whatsapp';
import { AppError } from '../middleware/errorHandler';

// ─── Legal Transitions Per Role ──────────────────────
//
//   pending    → preparing  (kitchen only)
//   pending    → cancelled  (kitchen or admin)
//   preparing  → ready      (kitchen only)
//   preparing  → cancelled  (kitchen or admin)
//   ready      → assigned   (admin only — assigns a driver)
//   assigned   → picked_up  (delivery only)
//   picked_up  → delivered  (delivery only)
//   delivered  → completed  (AUTOMATIC — system only)
//
// No other transitions are valid.

type AllowedRole = 'kitchen' | 'delivery' | 'admin' | 'system';

interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  allowedRoles: AllowedRole[];
}

const TRANSITIONS: Transition[] = [
  { from: 'pending',    to: 'preparing',  allowedRoles: ['kitchen', 'admin'] },
  { from: 'pending',    to: 'cancelled',  allowedRoles: ['kitchen', 'admin'] },
  { from: 'preparing',  to: 'ready',      allowedRoles: ['kitchen', 'admin'] },
  { from: 'preparing',  to: 'cancelled',  allowedRoles: ['kitchen', 'admin'] },
  { from: 'ready',      to: 'assigned',   allowedRoles: ['admin'] },
  { from: 'assigned',   to: 'picked_up',  allowedRoles: ['delivery', 'admin'] },
  { from: 'picked_up',  to: 'delivered',  allowedRoles: ['delivery', 'admin'] },
  { from: 'delivered',  to: 'completed',  allowedRoles: ['system'] }, // AUTO ONLY
];

// ─── Validate a transition ────────────────────────────
export function validateTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
  actorRole: string
): void {
  const transition = TRANSITIONS.find(
    (t) => t.from === currentStatus && t.to === newStatus
  );

  if (!transition) {
    throw new AppError(
      `Invalid transition: ${currentStatus} → ${newStatus}`,
      400
    );
  }

  if (!transition.allowedRoles.includes(actorRole as AllowedRole)) {
    throw new AppError(
      `Role '${actorRole}' cannot move order from ${currentStatus} to ${newStatus}`,
      403
    );
  }
}

// ─── Get allowed next statuses for a role ────────────
export function getAllowedTransitions(
  currentStatus: OrderStatus,
  actorRole: string
): OrderStatus[] {
  return TRANSITIONS
    .filter(
      (t) =>
        t.from === currentStatus &&
        t.allowedRoles.includes(actorRole as AllowedRole)
    )
    .map((t) => t.to);
}

// ─── Core: Apply Status Change ────────────────────────
//  All routes call this. It validates, saves, fires SSE, fires WhatsApp.

export async function applyStatusChange(
  orderId: string,
  newStatus: OrderStatus,
  actorRole: string,
  options: { driverId?: string } = {}
): Promise<ReturnType<typeof prisma.order.findUniqueOrThrow>> {
  // 1. Load order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { 
      customer: { select: { id: true, name: true, mobile: true } }, 
      driver: { select: { id: true, username: true } }, 
      items: true 
    },
  });

  if (!order) throw new AppError('Order not found', 404);

  // 2. Validate transition
  validateTransition(order.status, newStatus, actorRole);

  // 3. Build update payload
  const updateData: any = { status: newStatus };
  if (options.driverId) updateData.driverId = options.driverId;

  // 4. Save to database
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: { 
      customer: { select: { id: true, name: true, mobile: true } }, 
      driver: { select: { id: true, username: true } }, 
      items: true 
    },
  });

  // 5. Fire SSE events
  _fireSSE(updated, newStatus);

  // 6. Fire WhatsApp notifications
  await _fireWhatsApp(updated, newStatus);

  // 7. Auto-complete: delivered → completed
  if (newStatus === 'delivered') {
    return applyStatusChange(orderId, 'completed', 'system');
  }

  return updated as any;
}

// ─── SSE broadcast logic ──────────────────────────────
function _fireSSE(order: any, status: OrderStatus): void {
  const payload = { orderId: order.id, status, orderNumber: order.orderNumber };

  // Kitchen sees all active order changes
  sseManager.broadcastToKitchen('ORDER_UPDATED', payload);

  // Admin sees everything
  sseManager.broadcastToAdmin('ORDER_UPDATED', payload);

  // Customer sees their own order update
  sseManager.sendToCustomer(order.customerId, 'ORDER_UPDATED', payload);

  // Delivery panel: new assignment
  if (status === 'assigned') {
    sseManager.broadcastToDelivery('ORDER_ASSIGNED', order);
  }

  // Delivery panel: completed (remove from active list)
  if (status === 'completed' || status === 'cancelled') {
    sseManager.broadcastToDelivery('ORDER_UPDATED', payload);
  }
}

// ─── WhatsApp trigger logic ───────────────────────────
async function _fireWhatsApp(order: any, status: OrderStatus): Promise<void> {
  const mobile = order.customer?.mobile;
  if (!mobile) return;

  if (status === 'pending') {
    // Fired at order creation, not here
    return;
  }

  if (status === 'picked_up') {
    // Driver has the order — customer gets Out For Delivery message
    const mapsLink =
      order.deliveryLat && order.deliveryLng
        ? `https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`
        : undefined;

    await whatsappService.send('OUT_FOR_DELIVERY', mobile, {
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      trackingLink: mapsLink,
    });
  }

  if (status === 'completed') {
    await whatsappService.send('ORDER_COMPLETED', mobile, {
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
    });
  }
}
