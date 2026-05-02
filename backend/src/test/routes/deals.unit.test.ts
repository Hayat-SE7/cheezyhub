import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    deal: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    menuItem: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    staff: { findMany: vi.fn() },
  },
}));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ validateAndPriceOrder: vi.fn(), setItemAvailability: vi.fn(), setModifierAvailability: vi.fn() }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);
const adminToken = generateTestToken('admin-1', 'admin');

describe('[routes/deals] - GET /api/deals (public)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return active deals without auth', async () => {
    mockPrisma.deal.findMany.mockResolvedValue([
      { id: 'd1', title: '10% Off', isActive: true, linkedItemIds: [] },
    ] as any);

    const res = await request(app).get('/api/deals');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should resolve linkedItemIds to full items', async () => {
    mockPrisma.deal.findMany.mockResolvedValue([
      { id: 'd1', title: 'Combo', linkedItemIds: ['item-1'] },
    ] as any);
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: 'item-1', name: 'Burger', basePrice: 500 },
    ] as any);

    const res = await request(app).get('/api/deals');
    expect(res.status).toBe(200);
    expect(res.body.data[0].linkedItems).toHaveLength(1);
    expect(res.body.data[0].linkedItems[0].name).toBe('Burger');
  });
});

describe('[routes/deals] - POST /api/deals/admin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without auth', async () => {
    const res = await request(app).post('/api/deals/admin').send({ title: 'Test' });
    expect(res.status).toBe(401);
  });

  it('should return 400 for missing title', async () => {
    const res = await request(app)
      .post('/api/deals/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should create deal', async () => {
    mockPrisma.deal.create.mockResolvedValue({ id: 'd2', title: 'New Deal' } as any);

    const res = await request(app)
      .post('/api/deals/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'New Deal', discountType: 'percent', discountValue: 15 });
    expect(res.status).toBe(201);
  });
});

describe('[routes/deals] - PATCH /api/deals/admin/:id/toggle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should toggle deal active status', async () => {
    mockPrisma.deal.findUnique.mockResolvedValue({ id: 'd1', isActive: true } as any);
    mockPrisma.deal.update.mockResolvedValue({ id: 'd1', isActive: false } as any);

    const res = await request(app)
      .patch('/api/deals/admin/d1/toggle')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('should return 404 for non-existent deal', async () => {
    mockPrisma.deal.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/deals/admin/nonexistent/toggle')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('[routes/deals] - DELETE /api/deals/admin/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should delete deal', async () => {
    mockPrisma.deal.delete.mockResolvedValue({} as any);

    const res = await request(app)
      .delete('/api/deals/admin/d1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
