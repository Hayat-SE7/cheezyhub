import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    category: { findMany: vi.fn() },
    order: { findMany: vi.fn(), create: vi.fn() },
    shift: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    ledgerEntry: { upsert: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
    offlineSyncLog: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({
  validateAndPriceOrder: vi.fn().mockResolvedValue({ lines: [{ menuItemId: 'i1', menuItemName: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] }], subtotal: 500 }),
  setItemAvailability: vi.fn(), setModifierAvailability: vi.fn(),
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';
import { sseManager } from '../../services/sseManager';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);
const cashierToken = generateTestToken('cashier-1', 'cashier');
const customerToken = generateTestToken('cust-1', 'customer');

describe('[routes/counter] - auth guards', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/counter/menu');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-cashier/admin', async () => {
    const res = await request(app)
      .get('/api/counter/menu')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('[routes/counter] - POST /api/counter/orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for invalid body', async () => {
    const res = await request(app)
      .post('/api/counter/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 400 when no active shift', async () => {
    mockPrisma.shift.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/counter/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ items: [{ menuItemId: 'i1', quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('shift');
  });

  it('should create counter order and broadcast', async () => {
    mockPrisma.shift.findFirst.mockResolvedValue({ id: 'shift-1', cashierId: 'cashier-1', status: 'open' } as any);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: { create: vi.fn().mockResolvedValue({ id: 'ord-1', orderNumber: 'CH-POS', items: [], total: 500 }) },
        ledgerEntry: { create: vi.fn().mockResolvedValue({}) },
        shift: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const res = await request(app)
      .post('/api/counter/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ items: [{ menuItemId: 'i1', quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(sseManager.broadcastToKitchen).toHaveBeenCalled();
  });
});

describe('[routes/counter] - shift endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /shift/start should create new shift', async () => {
    mockPrisma.shift.findFirst.mockResolvedValue(null);
    mockPrisma.shift.create.mockResolvedValue({ id: 'shift-new', status: 'open' } as any);

    const res = await request(app)
      .post('/api/counter/shift/start')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ openingFloat: 5000 });
    expect(res.status).toBe(201);
  });

  it('POST /shift/start should return 409 if shift already open', async () => {
    mockPrisma.shift.findFirst.mockResolvedValue({ id: 'existing', status: 'open' } as any);

    const res = await request(app)
      .post('/api/counter/shift/start')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('POST /shift/end should return 400 without closingCash', async () => {
    const res = await request(app)
      .post('/api/counter/shift/end')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /shift/end should close shift with discrepancy calc', async () => {
    mockPrisma.shift.findFirst.mockResolvedValue({ id: 'shift-1', openingFloat: 5000 } as any);
    mockPrisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { cashAmount: 10000 } } as any);
    mockPrisma.shift.update.mockResolvedValue({ id: 'shift-1', status: 'closed' } as any);

    const res = await request(app)
      .post('/api/counter/shift/end')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ closingCash: 14500 });
    expect(res.status).toBe(200);
    expect(mockPrisma.shift.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'closed', discrepancy: -500 }),
      })
    );
  });
});

describe('[routes/counter] - POST /api/counter/sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for invalid batch', async () => {
    const res = await request(app)
      .post('/api/counter/sync')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orders: [] });
    expect(res.status).toBe(400);
  });

  it('should skip duplicate idempotency keys', async () => {
    mockPrisma.offlineSyncLog.findUnique.mockResolvedValue({ orderId: 'existing-ord' } as any);

    const res = await request(app)
      .post('/api/counter/sync')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        orders: [{
          idempotencyKey: 'dup-key',
          offlineCreatedAt: new Date().toISOString(),
          items: [{ menuItemId: 'i1', quantity: 1 }],
        }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.summary.duplicates).toBe(1);
  });
});
