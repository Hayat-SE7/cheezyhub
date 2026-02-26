import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sseManager } from '../services/sseManager';

export const sseRouter = Router();

// GET /api/sse/connect — establishes SSE stream
// Client sends JWT as ?token=... (EventSource doesn't support headers)
sseRouter.get('/connect', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const clientId = uuidv4();
  const { userId, role } = req.user!;

  sseManager.addClient(clientId, role, userId, res);
});
