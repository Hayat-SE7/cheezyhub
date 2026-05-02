import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sseManager } from '../services/sseManager';

export const sseRouter = Router();

// ─── SSE Ticket Store (short-lived, single-use) ─────
// Replaces raw JWT in query params to avoid token leakage in logs/history.
interface SseTicket {
  userId: string;
  role: string;
  expiresAt: number;
}

const ticketStore = new Map<string, SseTicket>();

// Sweep expired tickets every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, ticket] of ticketStore) {
    if (ticket.expiresAt < now) ticketStore.delete(id);
  }
}, 60_000);

// POST /api/sse/ticket — issue a 30s single-use ticket for SSE connection
sseRouter.post('/ticket', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const ticketId = crypto.randomBytes(24).toString('hex');
  ticketStore.set(ticketId, {
    userId: req.user!.userId,
    role: req.user!.role,
    expiresAt: Date.now() + 30_000,
  });
  res.json({ success: true, data: { ticket: ticketId } });
});

// GET /api/sse/connect — establishes SSE stream
// Accepts ?ticket= (preferred) or ?token= (legacy fallback)
sseRouter.get('/connect', (req: Request, res: Response) => {
  const ticketId = req.query.ticket as string | undefined;

  if (ticketId) {
    // Ticket-based auth (no JWT in URL)
    const ticket = ticketStore.get(ticketId);
    ticketStore.delete(ticketId); // single-use

    if (!ticket || ticket.expiresAt < Date.now()) {
      res.status(401).json({ success: false, error: 'Invalid or expired SSE ticket' });
      return;
    }

    const clientId = uuidv4();
    const lastEventId = (req.headers['last-event-id'] ?? req.query.lastEventId) as string | undefined;
    sseManager.addClient(clientId, ticket.role, ticket.userId, res, lastEventId);
    return;
  }

  // Legacy fallback: token-based (for backward compat during rollout)
  authenticate(req as AuthenticatedRequest, res, () => {
    const clientId = uuidv4();
    const { userId, role } = (req as AuthenticatedRequest).user!;
    const lastEventId = (req.headers['last-event-id'] ?? req.query.lastEventId) as string | undefined;
    sseManager.addClient(clientId, role, userId, res, lastEventId);
  });
});
