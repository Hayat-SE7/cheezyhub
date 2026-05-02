import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    systemSettings: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    order: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/inventoryService', () => ({
  validateAndPriceOrder: vi.fn().mockResolvedValue({
    lines: [{ menuItemId: 'i1', menuItemName: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] }],
    subtotal: 500,
  }),
  setItemAvailability: vi.fn(), setModifierAvailability: vi.fn(),
}));
vi.mock('../../services/radiusService', () => ({ checkDeliveryRadius: vi.fn(), isRadiusConfigured: vi.fn().mockReturnValue(false) }));
vi.mock('../../services/dealsService', () => ({ validateDeals: vi.fn().mockResolvedValue({ totalDiscount: 0, deals: [] }) }));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);
const customerToken = generateTestToken('cust-1', 'customer');

describe('[Concurrency] - Idempotency Keys', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 409 for duplicate idempotency key', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      ordersAccepting: true, deliveryFee: 0, freeDeliveryThreshold: 0, serviceCharge: 0,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'cust-1', name: 'Test', mobile: '+923001234567' } as any);

    // Transaction returns existing order (idempotency hit)
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findFirst: vi.fn().mockResolvedValue({
            _duplicate: true, id: 'existing-ord', orderNumber: 'CH-EXISTING',
          }),
          create: vi.fn(),
        },
      };
      return fn(tx);
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        idempotencyKey: 'same-key-123',
        items: [{ menuItemId: 'i1', quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: '123 Test St',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Duplicate');
  });

  it('should create order with new idempotency key', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      ordersAccepting: true, deliveryFee: 100, freeDeliveryThreshold: 0, serviceCharge: 0,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'cust-1', name: 'Test', mobile: '+923001234567' } as any);

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findFirst: vi.fn().mockResolvedValue(null), // no existing order for this key
          create: vi.fn().mockResolvedValue({
            id: 'new-ord', orderNumber: 'CH-NEW', status: 'pending', total: 600,
            items: [], customer: { id: 'cust-1', name: 'Test', mobile: '+923001234567' },
          }),
        },
      };
      return fn(tx);
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        idempotencyKey: 'unique-key-456',
        items: [{ menuItemId: 'i1', quantity: 1, selectedModifierIds: [] }],
        deliveryAddress: '123 Test St',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toBe('CH-NEW');
  });

  it('should handle concurrent requests with same idempotency key', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      ordersAccepting: true, deliveryFee: 0, freeDeliveryThreshold: 0, serviceCharge: 0,
    } as any);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'cust-1', name: 'Test', mobile: '+923001234567' } as any);

    let txCallCount = 0;
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      txCallCount++;
      const tx = {
        order: {
          // First call: no existing, creates new
          // Second call: finds existing (race lost)
          findFirst: vi.fn().mockResolvedValue(
            txCallCount === 1
              ? null
              : { _duplicate: true, id: 'first-ord', orderNumber: 'CH-FIRST' }
          ),
          create: vi.fn().mockResolvedValue({
            id: 'first-ord', orderNumber: 'CH-FIRST', status: 'pending', total: 500,
            items: [], customer: { id: 'cust-1', name: 'Test', mobile: '+923001234567' },
          }),
        },
      };
      return fn(tx);
    });

    const body = {
      idempotencyKey: 'race-key',
      items: [{ menuItemId: 'i1', quantity: 1, selectedModifierIds: [] }],
      deliveryAddress: '123 Test St',
    };

    const [res1, res2] = await Promise.all([
      request(app).post('/api/orders').set('Authorization', `Bearer ${customerToken}`).send(body),
      request(app).post('/api/orders').set('Authorization', `Bearer ${customerToken}`).send(body),
    ]);

    // One should be 201, the other 409
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
});
