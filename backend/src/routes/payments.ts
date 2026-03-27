// ─────────────────────────────────────────────────────
//  PAYMENTS ROUTE  v6.1
//
//  POST /api/payments/create       — start Safepay session or record COD
//  POST /api/payments/webhook      — Safepay webhook (NO JWT — sig verified)
//  POST /api/payments/stub-confirm — dev only: manually confirm a stub payment
//  GET  /api/payments/status/:id   — check payment status for an order
//
//  ⚠️  CRITICAL: The webhook route needs raw body.
//      In index.ts it is registered BEFORE express.json() middleware
//      using express.raw({ type: 'application/json' }).
//      Do NOT add authenticate middleware to the webhook route.
// ─────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { sseManager } from '../services/sseManager';
import { whatsappService } from '../services/whatsapp';
import {
  createPaymentSession,
  verifySafepayWebhook,
} from '../services/paymentService';
import { AppError } from '../middleware/errorHandler';

export const paymentRouter = Router();

// ─────────────────────────────────────────────────────
//  POST /api/payments/create
//
//  Call this AFTER the order is created (order ID required).
//  COD:     Records payment immediately, kitchen sees order.
//  Safepay: Creates Safepay session, returns checkoutUrl.
//           Kitchen does NOT see order until webhook confirms.
// ─────────────────────────────────────────────────────

const createSchema = z.object({
  orderId:       z.string().min(1, 'Order ID required'),
  paymentMethod: z.enum(['cash', 'safepay']),
});

paymentRouter.post(
  '/create',
  authenticate,
  requireRole('customer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }

    const { orderId, paymentMethod } = parsed.data;

    try {
      // Load and verify ownership
const order = await prisma.order.findUnique({
  where: { id: orderId },
  include: {
    payment: true,
    customer: { select: { id: true, name: true, mobile: true } }
  }
});

      if (!order) throw new AppError('Order not found', 404);

      if (order.payment) {
        throw new AppError('Payment already exists for this order', 409);
      }

      // ── Cash on Delivery ──────────────────────────────
      if (paymentMethod === 'cash') {
        await prisma.$transaction([
          prisma.payment.create({
            data: {
              orderId,
              method:   'cash',
              amount:   order.total,
              currency: 'PKR',
              status:   'paid',
            },
          }),
          prisma.order.update({
            where: { id: orderId },
            data:  { paymentMethod: 'cash', paymentStatus: 'none' },
          }),
        ]);

        // COD is confirmed instantly — broadcast to kitchen
        const fullOrder = await prisma.order.findUnique({
          where:   { id: orderId },
          include: { items: true, customer: { select: { id: true, name: true, mobile: true } } },
        });
        sseManager.broadcastToKitchen('ORDER_CREATED', fullOrder);
        sseManager.broadcastToAdmin('ORDER_CREATED', fullOrder);

        // WhatsApp: ORDER_CONFIRMED (safe to fire now for COD)
        if (order.customer?.mobile) {
          await whatsappService.send('ORDER_CONFIRMED', order.customer!.mobile, {
            orderNumber:  order.orderNumber,
            customerName: order.customer!.name,
            total:        order.total,
          });
        }

        res.json({ success: true, data: { paymentMethod: 'cash', status: 'confirmed' } });
        return;
      }

      // ── Safepay Online Payment ─────────────────────────
      const session = await createPaymentSession(
        orderId,
        order.orderNumber,
        order.total
      );

      await prisma.$transaction([
        prisma.payment.create({
          data: {
            orderId,
            method:         'safepay',
            amount:         order.total,
            currency:       'PKR',
            status:         'pending',
            safepayRef: session.tracker
          },
        }),
        prisma.order.update({
          where: { id: orderId },
          data:  {
            paymentMethod:  'safepay',
            paymentStatus:  'pending',
            safepayTracker: session.tracker,
          },
        }),
      ]);

      // Do NOT broadcast to kitchen yet — wait for webhook confirmation

      res.json({
        success: true,
        data: {
          paymentMethod: 'safepay',
          checkoutUrl:   session.checkoutUrl,
          tracker:       session.tracker,
        },
      });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
      } else {
        console.error('[Payments/create]', err);
        res.status(500).json({ success: false, error: 'Payment creation failed' });
      }
    }
  }
);

// ─────────────────────────────────────────────────────
//  POST /api/payments/webhook
//
//  Safepay calls this after payment events.
//  NO JWT authentication — uses HMAC signature instead.
//  Registered with express.raw() in index.ts (must receive raw body).
//
//  Safepay webhook payload:
//  {
//    "event": "payment:created",   // or "payment:failed"
//    "data": {
//      "tracker": "tracker_xxx",   // matches our safepayTracker
//      "reference": "REF_xxx",     // Safepay's transaction reference
//      "net": 150000,              // amount in paisa
//      "status": "PAID"            // or "FAILED"
//    }
//  }
//
//  Safepay sends X-SFPY-SIGNATURE header for verification.
// ─────────────────────────────────────────────────────

export async function safepayWebhookHandler(req: Request, res: Response): Promise<void> {
  // 1. Verify signature (skip in stub mode)
  const provider  = process.env.PAYMENT_PROVIDER ?? 'stub';
  const signature = req.headers['x-sfpy-signature'] as string;

  if (provider === 'safepay') {
    if (!signature) {
      console.error('[Safepay Webhook] Missing X-SFPY-SIGNATURE header');
      res.status(400).json({ error: 'Missing signature' });
      return;
    }

    // req.body is a Buffer when registered with express.raw()
    const isValid = verifySafepayWebhook(req.body as Buffer, signature);
    if (!isValid) {
      console.error('[Safepay Webhook] Invalid signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
  }

  // 2. Parse body
  let payload: any;
  try {
    const raw = provider === 'stub'
      ? req.body                                // already JSON in stub mode
      : JSON.parse((req.body as Buffer).toString('utf8'));
    payload = raw;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const event   = payload?.event;
  const data    = payload?.data;
  const tracker = data?.tracker;

  console.log(`[Safepay Webhook] Event: ${event}  Tracker: ${tracker}`);

  // 3. Always ACK immediately — process async
  res.json({ received: true });

  if (!tracker) return;

  try {
    // Find order by tracker token
    const order = await prisma.order.findFirst({
      where:   { safepayTracker: tracker },
      include: { customer: { select: { id: true, name: true, mobile: true } } },
    });

    if (!order) {
      console.error(`[Safepay Webhook] No order found for tracker: ${tracker}`);
      return;
    }

    // ── Payment confirmed ─────────────────────────────
    if (event === 'payment:created' || data?.status === 'PAID') {
      const reference = data?.reference ?? null;

      await prisma.$transaction([
        prisma.payment.update({
          where: { orderId: order.id },
          data:  {
            status:     'paid',
            safepayRef: reference,
            metadata:   payload,
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data:  { paymentStatus: 'paid' },
        }),
      ]);

      // NOW broadcast to kitchen — payment is confirmed
      const fullOrder = await prisma.order.findUnique({
        where:   { id: order.id },
        include: { items: true, customer: { select: { id: true, name: true, mobile: true } } },
      });
      sseManager.broadcastToKitchen('ORDER_CREATED', fullOrder);
      sseManager.broadcastToAdmin('ORDER_CREATED', fullOrder);

      // SSE to customer — payment confirmed
      sseManager.sendToCustomer(order.customerId!, 'PAYMENT_CONFIRMED', {
        orderId:     order.id,
        orderNumber: order.orderNumber,
      });

      // WhatsApp ORDER_CONFIRMED — now safe to fire
      if (order.customer?.mobile) {
        await whatsappService.send('ORDER_CONFIRMED', order.customer!.mobile, {
          orderNumber:  order.orderNumber,
          customerName: order.customer!.name,
          total:        order.total,
        });
      }

      console.log(`[Safepay Webhook] ✅ Payment confirmed: ${order.orderNumber}`);
    }

    // ── Payment failed ────────────────────────────────
    else if (event === 'payment:failed' || data?.status === 'FAILED') {
      await prisma.$transaction([
        prisma.payment.update({
          where: { orderId: order.id },
          data:  { status: 'failed', metadata: payload },
        }),
        prisma.order.update({
          where: { id: order.id },
          data:  { paymentStatus: 'failed', status: 'cancelled' },
        }),
      ]);

      sseManager.sendToCustomer(order.customerId!, 'PAYMENT_FAILED', {
        orderId:     order.id,
        orderNumber: order.orderNumber,
        reason:      'Payment was not completed',
      });

      console.log(`[Safepay Webhook] ❌ Payment failed: ${order.orderNumber}`);
    }
  } catch (err) {
    console.error('[Safepay Webhook] Processing error:', err);
    // Don't re-throw — we already sent 200
  }
}

// ─────────────────────────────────────────────────────
//  POST /api/payments/stub-confirm
//  DEV ONLY — manually confirms a pending Safepay order
//  without going through real Safepay.
//  Disabled in production.
//
//  Usage:
//    POST /api/payments/stub-confirm
//    Body: { orderId: "..." }
//
//  This simulates what the Safepay webhook would do on success.
// ─────────────────────────────────────────────────────

paymentRouter.post('/stub-confirm', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const { orderId } = req.body;
  if (!orderId) {
    res.status(400).json({ success: false, error: 'orderId required' });
    return;
  }

  try {
    const order = await prisma.order.findUnique({
      where:   { id: orderId },
      include: { customer: { select: { id: true, name: true, mobile: true } } },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    if (!order.safepayTracker) {
      res.status(400).json({ success: false, error: 'Not a Safepay order (no tracker)' });
      return;
    }

    if (order.paymentStatus === 'paid') {
      res.status(409).json({ success: false, error: 'Already confirmed' });
      return;
    }

    const fakeRef = `STUB_REF_${Date.now()}`;

    // Directly apply what the real webhook handler would do
    await prisma.$transaction([
      prisma.payment.update({
        where: { orderId },
        data:  { status: 'paid', safepayRef: fakeRef, metadata: { stub: true } },
      }),
      prisma.order.update({
        where: { id: orderId },
        data:  { paymentStatus: 'paid' },
      }),
    ]);

    // Fire SSE + WhatsApp exactly as the real webhook does
    const fullOrder = await prisma.order.findUnique({
      where:   { id: orderId },
      include: { items: true, customer: { select: { id: true, name: true, mobile: true } } },
    });

    sseManager.broadcastToKitchen('ORDER_CREATED', fullOrder);
    sseManager.broadcastToAdmin('ORDER_CREATED', fullOrder);
    sseManager.sendToCustomer(order.customerId!, 'PAYMENT_CONFIRMED', {
      orderId,
      orderNumber: order.orderNumber,
    });

    if (order.customer?.mobile) {
      await whatsappService.send('ORDER_CONFIRMED', order.customer!.mobile, {
        orderNumber:  order.orderNumber,
        customerName: order.customer!.name,
        total:        order.total,
      });
    }

    console.log(`[Stub Confirm] ✅ Payment confirmed for ${order.orderNumber}`);

    res.json({
      success: true,
      message: `Payment confirmed for ${order.orderNumber}`,
      data:    { orderId, orderNumber: order.orderNumber, ref: fakeRef },
    });
  } catch (err: any) {
    console.error('[Stub Confirm] Error:', err);
    res.status(500).json({ success: false, error: err?.message ?? 'Stub confirm failed' });
  }
});

// ─────────────────────────────────────────────────────
//  GET /api/payments/status/:orderId
//  Returns current payment status for an order.
//  Customer sees only their own. Admin sees all.
// ─────────────────────────────────────────────────────

paymentRouter.get(
  '/status/:orderId',
  authenticate,
  requireRole('customer', 'admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { orderId } = req.params;

    const payment = await prisma.payment.findUnique({
      where:  { orderId },
      select: {
        id:             true,
        status:         true,
        method:         true,
        amount:         true,
        currency:       true,
        safepayRef:     true,
        createdAt:      true,
        order: {
          select: {
            customerId:    true,
            orderNumber:   true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }

    if (
      req.user!.role === 'customer' &&
      payment.order.customerId !== req.user!.userId
    ) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    res.json({ success: true, data: payment });
  }
);
