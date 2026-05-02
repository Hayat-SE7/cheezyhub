import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    order: { findMany: vi.fn(), count: vi.fn() },
    menuItem: { update: vi.fn() },
    modifier: { update: vi.fn() },
    systemSettings: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ setItemAvailability: vi.fn(), setModifierAvailability: vi.fn(), validateAndPriceOrder: vi.fn() }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';
import { applyStatusChange } from '../../services/orderLifecycle';
import { sseManager } from '../../services/sseManager';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);
const kitchenToken = generateTestToken('kit-1', 'kitchen');
const customerToken = generateTestToken('cust-1', 'customer');

describe('[routes/kitchen] - GET /api/kitchen/orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/kitchen/orders');
    expect(res.status).toBe(401);
  });

  it('should return 403 for customer role', async () => {
    const res = await request(app)
      .get('/api/kitchen/orders')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('should return active orders for kitchen', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'o1', status: 'pending', items: [] },
      { id: 'o2', status: 'preparing', items: [] },
    ] as any);

    const res = await request(app)
      .get('/api/kitchen/orders')
      .set('Authorization', `Bearer ${kitchenToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('[routes/kitchen] - PATCH /api/kitchen/orders/:id/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 when status is missing', async () => {
    const res = await request(app)
      .patch('/api/kitchen/orders/ord-1/status')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should update order status via lifecycle engine', async () => {
    vi.mocked(applyStatusChange).mockResolvedValue({ id: 'ord-1', status: 'preparing' } as any);

    const res = await request(app)
      .patch('/api/kitchen/orders/ord-1/status')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'preparing' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('preparing');
  });
});

describe('[routes/kitchen] - PATCH /api/kitchen/inventory/items/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 when isAvailable is not boolean', async () => {
    const res = await request(app)
      .patch('/api/kitchen/inventory/items/item-1')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ isAvailable: 'yes' });
    expect(res.status).toBe(400);
  });

  it('should toggle item availability and broadcast', async () => {
    const res = await request(app)
      .patch('/api/kitchen/inventory/items/item-1')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(sseManager.broadcastAll).toHaveBeenCalledWith('ITEM_AVAILABILITY', { itemId: 'item-1', isAvailable: false });
  });
});

describe('[routes/kitchen] - PATCH /api/kitchen/pause', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 when paused is not boolean', async () => {
    const res = await request(app)
      .patch('/api/kitchen/pause')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ paused: 'true' });
    expect(res.status).toBe(400);
  });

  it('should toggle orders paused state', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({ id: 's1' } as any);
    mockPrisma.systemSettings.update.mockResolvedValue({} as any);

    const res = await request(app)
      .patch('/api/kitchen/pause')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ paused: true });
    expect(res.status).toBe(200);
    expect(sseManager.broadcastAll).toHaveBeenCalledWith('ORDERS_PAUSED', { paused: true });
  });
});
