// ─────────────────────────────────────────────────────
//  SUPPORT TICKETS ROUTE
//  Handles:
//    ✅ Customer creates ticket (low/medium/high)
//    ✅ Admin replies → WhatsApp TICKET_REPLY fires
//    ✅ Role-scoped visibility (customer sees own, admin sees all)
//    ✅ Status management (open → in_progress → resolved)
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { whatsappService } from '../services/whatsapp';
import { AppError } from '../middleware/errorHandler';

export const ticketRouter = Router();

ticketRouter.use(authenticate);

// ─── Validation ──────────────────────────────────────

const createTicketSchema = z.object({
  subject: z.string().min(3, 'Subject too short').max(150),
  message: z.string().min(10, 'Message too short').max(2000),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  orderId: z.string().optional(),
});

const replySchema = z.object({
  message: z.string().min(1).max(2000),
});

// ─── POST /api/tickets — customer creates a ticket ────

ticketRouter.post(
  '/',
  requireRole('customer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? 'Invalid ticket data';
      res.status(400).json({ success: false, error: firstError });
      return;
    }

    const { subject, message, priority, orderId } = parsed.data;

    // If orderId provided, verify it belongs to this customer
    if (orderId) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, customerId: req.user!.userId },
      });
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found or not yours' });
        return;
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        customerId: req.user!.userId,
        subject,
        priority,
        orderId,
        messages: {
          create: {
            message,
            senderRole: 'customer',
            senderId: req.user!.userId,
          },
        },
      },
      include: {
        messages: true,
        customer: { select: { id: true, name: true, mobile: true } },
      },
    });

    res.status(201).json({ success: true, data: ticket });
  }
);

// ─── GET /api/tickets — list tickets ──────────────────
//     Customer sees their own. Admin sees all.

ticketRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const where =
    req.user!.role === 'customer' ? { customerId: req.user!.userId } : {};

  const { status, priority } = req.query as Record<string, string>;
  if (status) (where as any).status = status;
  if (priority) (where as any).priority = priority;

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, mobile: true } },
      messages: { orderBy: { createdAt: 'asc' }, take: 1 }, // latest msg preview
    },
    orderBy: [
      // High priority first, then by most recently updated
      { priority: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  res.json({ success: true, data: tickets });
});

// ─── GET /api/tickets/:id — single ticket with messages

ticketRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      customer: { select: { id: true, name: true, mobile: true } },
    },
  });

  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }

  if (req.user!.role === 'customer' && ticket.customerId !== req.user!.userId) {
    res.status(403).json({ success: false, error: 'You can only view your own tickets' });
    return;
  }

  res.json({ success: true, data: ticket });
});

// ─── POST /api/tickets/:id/reply — add a message ──────

ticketRouter.post('/:id/reply', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Message is required' });
    return;
  }

  const { message } = parsed.data;

  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      customer: { select: { id: true, name: true, mobile: true } },
    },
  });

  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }

  // Customers can only reply to their own tickets
  if (req.user!.role === 'customer' && ticket.customerId !== req.user!.userId) {
    res.status(403).json({ success: false, error: 'Not your ticket' });
    return;
  }

  // Prevent replies to closed tickets
  if (ticket.status === 'closed') {
    res.status(400).json({ success: false, error: 'This ticket is closed' });
    return;
  }

  // Save the message
  const msg = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      message,
      senderRole: req.user!.role as any,
      senderId: req.user!.userId,
    },
  });

  // Update ticket status and timestamp
  const newStatus = req.user!.role === 'admin' ? 'in_progress' : 'open';
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: newStatus, updatedAt: new Date() },
  });

  // ── WhatsApp: notify customer when ADMIN replies ──
  if (req.user!.role === 'admin' && ticket.customer.mobile) {
    await whatsappService.send('TICKET_REPLY', ticket.customer.mobile, {
      ticketId: ticket.id,
      adminReply: message,
      customerName: ticket.customer.name,
    });
  }

  res.status(201).json({ success: true, data: msg });
});

// ─── PATCH /api/tickets/:id/status — admin changes status

ticketRouter.patch(
  '/:id/status',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];

    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ success: true, data: ticket });
  }
);
