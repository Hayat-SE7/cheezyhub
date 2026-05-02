import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {},
}));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ validateAndPriceOrder: vi.fn(), setItemAvailability: vi.fn(), setModifierAvailability: vi.fn() }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';
import { sseManager } from '../../services/sseManager';

const app = createTestApp();
const customerToken = generateTestToken('cust-1', 'customer');

describe('[routes/sse] - POST /api/sse/ticket', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without auth', async () => {
    const res = await request(app).post('/api/sse/ticket');
    expect(res.status).toBe(401);
  });

  it('should issue a ticket for authenticated user', async () => {
    const res = await request(app)
      .post('/api/sse/ticket')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ticket).toBeDefined();
    expect(res.body.data.ticket.length).toBeGreaterThan(10);
  });
});

describe('[routes/sse] - GET /api/sse/connect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 for invalid ticket', async () => {
    const res = await request(app).get('/api/sse/connect?ticket=invalid-ticket');
    expect(res.status).toBe(401);
  });

  it('should call addClient with valid ticket', async () => {
    // SSE endpoints keep the connection open, so we can't use supertest's
    // normal await. Instead we verify addClient gets called by making
    // the request and immediately destroying it.
    const ticketRes = await request(app)
      .post('/api/sse/ticket')
      .set('Authorization', `Bearer ${customerToken}`);
    const ticket = ticketRes.body.data.ticket;

    // Make the SSE request but abort quickly since it would hang
    const req = request(app).get(`/api/sse/connect?ticket=${ticket}`);
    // Use a race with a short timeout
    const result = await Promise.race([
      req,
      new Promise<null>((resolve) => setTimeout(() => {
        req.abort();
        resolve(null);
      }, 200)),
    ]);

    // If addClient was called, the ticket was valid
    expect(sseManager.addClient).toHaveBeenCalledWith(
      expect.any(String),
      'customer',
      'cust-1',
      expect.any(Object),
      undefined,
    );
  });

  it('should reject reused (single-use) ticket via direct ticket store check', async () => {
    // Get a ticket
    const ticketRes = await request(app)
      .post('/api/sse/ticket')
      .set('Authorization', `Bearer ${customerToken}`);
    const ticket = ticketRes.body.data.ticket;

    // First use — abort immediately, ticket gets consumed
    const req1 = request(app).get(`/api/sse/connect?ticket=${ticket}`);
    await Promise.race([
      req1,
      new Promise<null>((resolve) => setTimeout(() => { req1.abort(); resolve(null); }, 200)),
    ]);

    // Second use with same ticket — should get 401 since ticket was consumed
    const res = await request(app).get(`/api/sse/connect?ticket=${ticket}`);
    expect(res.status).toBe(401);
  });
});
