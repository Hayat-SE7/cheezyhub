import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    staff: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
    order: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    orderItem: { groupBy: vi.fn() },
    systemSettings: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    deal: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    category: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    menuItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    modifier: { update: vi.fn() },
    ticket: { count: vi.fn() },
    notificationLog: { findMany: vi.fn() },
    refreshToken: { create: vi.fn() },
  },
}));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ validateAndPriceOrder: vi.fn(), setItemAvailability: vi.fn(), setModifierAvailability: vi.fn() }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));
vi.mock('../../utils/csv', () => ({ toCsv: vi.fn().mockReturnValue('csv-data'), csvHeaders: vi.fn().mockReturnValue({}) }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);
const adminToken = generateTestToken('admin-1', 'admin');
const customerToken = generateTestToken('cust-1', 'customer');

describe('[routes/admin] - auth guards', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin role', async () => {
    const res = await request(app)
      .get('/api/admin/staff')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('[routes/admin] - GET /api/admin/staff', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return staff list', async () => {
    mockPrisma.staff.findMany.mockResolvedValue([
      { id: 's1', username: 'chef', role: 'kitchen' },
    ] as any);

    const res = await request(app)
      .get('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('[routes/admin] - POST /api/admin/staff', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'test' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid role', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'test', pin: '1234', role: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('should create staff member', async () => {
    mockPrisma.staff.create.mockResolvedValue({
      id: 's2', username: 'newchef', role: 'kitchen', isActive: true,
    } as any);

    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'newchef', pin: '1234', role: 'kitchen' });
    expect(res.status).toBe(201);
  });

  it('should return 409 for duplicate username', async () => {
    mockPrisma.staff.create.mockRejectedValue(new Error('unique'));

    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'existing', pin: '1234', role: 'kitchen' });
    expect(res.status).toBe(409);
  });
});

describe('[routes/admin] - GET /api/admin/settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return settings', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      id: 's1', deliveryFee: 150, restaurantName: 'CheezyHub',
    } as any);

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.restaurantName).toBe('CheezyHub');
  });

  it('should create default settings if none exist', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue(null);
    mockPrisma.systemSettings.create.mockResolvedValue({
      id: 's1', deliveryFee: 150, restaurantName: 'CheezyHub',
    } as any);

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('[routes/admin] - GET /api/admin/stats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return dashboard stats', async () => {
    mockPrisma.order.count.mockResolvedValue(50);
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { total: 100000 } } as any);
    mockPrisma.ticket.count.mockResolvedValue(3);
    mockPrisma.user.count.mockResolvedValue(100);

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalOrders');
    expect(res.body.data).toHaveProperty('totalRevenue');
  });
});

describe('[routes/admin] - DELETE /api/admin/staff/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should delete staff member', async () => {
    mockPrisma.staff.delete.mockResolvedValue({} as any);
    const res = await request(app)
      .delete('/api/admin/staff/s1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('should return 409 for foreign key conflict', async () => {
    mockPrisma.staff.delete.mockRejectedValue({ code: 'P2003' });
    const res = await request(app)
      .delete('/api/admin/staff/s1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('should return 404 for non-existent staff', async () => {
    mockPrisma.staff.delete.mockRejectedValue({ code: 'P2025' });
    const res = await request(app)
      .delete('/api/admin/staff/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
