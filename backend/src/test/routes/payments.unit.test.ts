import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    order: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    processedWebhook: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ validateAndPriceOrder: vi.fn(), setItemAvailability: vi.fn(), setModifierAvailability: vi.fn() }));
vi.mock('../../services/paymentService', () => ({
  createPaymentSession: vi.fn().mockResolvedValue({ checkoutUrl: 'https://pay.test/checkout', tracker: 'trk_123' }),
  verifySafepayWebhook: vi.fn().mockReturnValue(true),
}));
vi.mock('../../services/whatsapp', () => ({ whatsappService: { send: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';
import { sseManager } from '../../services/sseManager';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);
const customerToken = generateTestToken('cust-1', 'customer');
const adminToken = generateTestToken('admin-1', 'admin');

describe('[routes/payments] - POST /api/payments/create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without token', async () => {
    const res = await request(app).post('/api/payments/create').send({});
    expect(res.status).toBe(401);
  });

  it('should return 400 for missing orderId', async () => {
    const res = await request(app)
      .post('/api/payments/create')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentMethod: 'cash' });
    expect(res.status).toBe(400);
  });

  it('should handle COD payment and broadcast to kitchen', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord-1', customerId: 'cust-1', total: 1000, orderNumber: 'CH-1',
            payment: null, customer: { id: 'cust-1', name: 'Test', mobile: '+923001234567' },
          }),
          update: vi.fn(),
        },
        payment: { create: vi.fn() },
      };
      return fn(tx);
    });
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'ord-1', items: [], customer: { id: 'cust-1', name: 'Test', mobile: '+923001234567' },
    } as any);

    const res = await request(app)
      .post('/api/payments/create')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId: 'ord-1', paymentMethod: 'cash' });
    expect(res.status).toBe(200);
    expect(res.body.data.paymentMethod).toBe('cash');
    expect(sseManager.broadcastToKitchen).toHaveBeenCalled();
  });

  it('should return 403 when paying for another customer order', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord-1', customerId: 'other-cust', total: 500, payment: null,
          }),
        },
      };
      return fn(tx);
    });

    const res = await request(app)
      .post('/api/payments/create')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId: 'ord-1', paymentMethod: 'cash' });
    expect(res.status).toBe(403);
  });

  it('should return 409 when payment already exists', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ord-1', customerId: 'cust-1', total: 500, payment: { id: 'pay-1' },
          }),
        },
      };
      return fn(tx);
    });

    const res = await request(app)
      .post('/api/payments/create')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId: 'ord-1', paymentMethod: 'cash' });
    expect(res.status).toBe(409);
  });

  it('should create safepay session and return checkout URL', async () => {
    mockPrisma.$transaction
      .mockImplementationOnce(async (fn: any) => {
        const tx = {
          order: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'ord-1', customerId: 'cust-1', total: 2000, orderNumber: 'CH-2',
              payment: null, customer: { id: 'cust-1', name: 'Test', mobile: '+923001234567' },
            }),
          },
        };
        return fn(tx);
      })
      .mockResolvedValueOnce(undefined); // second $transaction for payment + order update

    const res = await request(app)
      .post('/api/payments/create')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId: 'ord-1', paymentMethod: 'safepay' });
    expect(res.status).toBe(200);
    expect(res.body.data.checkoutUrl).toBe('https://pay.test/checkout');
    expect(res.body.data.tracker).toBe('trk_123');
  });
});

describe('[routes/payments] - GET /api/payments/status/:orderId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 404 when payment not found', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/payments/status/ord-1')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(404);
  });

  it('should return 403 when customer views another payment', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', status: 'paid', order: { customerId: 'other-cust', orderNumber: 'CH-X', paymentStatus: 'paid' },
    } as any);

    const res = await request(app)
      .get('/api/payments/status/ord-1')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('should return payment status for owner', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', status: 'paid', method: 'cash', amount: 1000,
      order: { customerId: 'cust-1', orderNumber: 'CH-1', paymentStatus: 'paid' },
    } as any);

    const res = await request(app)
      .get('/api/payments/status/ord-1')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paid');
  });
});
