import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

// Mock deps
vi.mock('../../config/db', () => ({
  prisma: {
    systemSettings: { findFirst: vi.fn() },
    order: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), $transaction: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/inventoryService', () => ({
  validateAndPriceOrder: vi.fn(),
  setItemAvailability: vi.fn(),
  setModifierAvailability: vi.fn(),
}));
vi.mock('../../services/radiusService', () => ({
  checkDeliveryRadius: vi.fn().mockReturnValue({ allowed: true, distanceKm: 5 }),
  isRadiusConfigured: vi.fn().mockReturnValue(false),
}));
vi.mock('../../services/dealsService', () => ({
  validateDeals: vi.fn().mockResolvedValue({ totalDiscount: 0, deals: [] }),
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';
import { validateAndPriceOrder } from '../../services/inventoryService';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);
const customerToken = generateTestToken('cust-1', 'customer');
const kitchenToken = generateTestToken('kitchen-1', 'kitchen');

describe('[routes/orders] - POST /api/orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without token', async () => {
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-customer role', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ items: [{ menuItemId: 'x', quantity: 1 }], deliveryAddress: '123 Test St' });
    expect(res.status).toBe(403);
  });

  it('should return 400 for missing items', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ deliveryAddress: '123 Test St' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for empty items array', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [], deliveryAddress: '123 Test St' });
    expect(res.status).toBe(400);
  });

  it('should return 503 when orders are paused', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({ ordersAccepting: false } as any);
    vi.mocked(validateAndPriceOrder).mockResolvedValue({ lines: [], subtotal: 500 } as any);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: '123 Test Street',
      });
    expect(res.status).toBe(503);
  });

  it('should return 201 for valid order', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({ ordersAccepting: true, deliveryFee: 100, freeDeliveryThreshold: 0, serviceCharge: 0 } as any);
    vi.mocked(validateAndPriceOrder).mockResolvedValue({
      lines: [{ menuItemId: 'item-1', menuItemName: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] }],
      subtotal: 500,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'cust-1', name: 'Test', mobile: '+923001234567' } as any);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const mockTx = {
        order: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'ord-1', orderNumber: 'CH-TEST', status: 'pending', total: 600,
            items: [{ menuItemName: 'Burger', quantity: 1 }],
            customer: { id: 'cust-1', name: 'Test', mobile: '+923001234567' },
          }),
        },
      };
      return fn(mockTx);
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: '123 Test Street',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 409 for duplicate idempotency key', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({ ordersAccepting: true, deliveryFee: 0, freeDeliveryThreshold: 0, serviceCharge: 0 } as any);
    vi.mocked(validateAndPriceOrder).mockResolvedValue({ lines: [], subtotal: 500 } as any);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'cust-1', name: 'Test', mobile: '+923001234567' } as any);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const mockTx = {
        order: {
          findFirst: vi.fn().mockResolvedValue({ _duplicate: true, id: 'dup-1', orderNumber: 'CH-DUP' }),
          create: vi.fn(),
        },
      };
      return fn(mockTx);
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        idempotencyKey: 'dup-key-1',
        items: [{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: '123 Test Street',
      });
    expect(res.status).toBe(409);
  });
});

describe('[routes/orders] - GET /api/orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('should return paginated orders for customer', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ id: 'ord-1', orderNumber: 'CH-1' }] as any);
    mockPrisma.order.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });
});

describe('[routes/orders] - GET /api/orders/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 404 for non-existent order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/orders/nonexistent')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });

  it('should return 403 when customer tries to view another customer order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'ord-1', customerId: 'other-customer',
    } as any);

    const res = await request(app)
      .get('/api/orders/ord-1')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('should return order for the owner', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'ord-1', customerId: 'cust-1', orderNumber: 'CH-1',
    } as any);

    const res = await request(app)
      .get('/api/orders/ord-1')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orderNumber).toBe('CH-1');
  });
});
