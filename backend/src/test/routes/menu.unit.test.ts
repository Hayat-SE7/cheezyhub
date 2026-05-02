import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    category: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    menuItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    modifier: { update: vi.fn() },
    modifierGroup: { deleteMany: vi.fn() },
    systemSettings: { findFirst: vi.fn() },
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

describe('[routes/menu] - GET /api/menu (public)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return menu categories with available items', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Burgers', items: [{ id: 'i1', name: 'Classic Burger', isAvailable: true }] },
    ] as any);

    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Burgers');
  });

  it('should return empty array when no categories exist', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('[routes/menu] - GET /api/menu/settings/public', () => {
  it('should return public settings without auth', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue({
      deliveryFee: 150, freeDeliveryThreshold: 1500, serviceCharge: 50,
      restaurantName: 'CheezyHub', ordersAccepting: true,
    } as any);

    const res = await request(app).get('/api/menu/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.data.restaurantName).toBe('CheezyHub');
    expect(res.body.data.deliveryFee).toBe(150);
  });

  it('should return defaults when no settings exist', async () => {
    mockPrisma.systemSettings.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/menu/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.data.deliveryFee).toBe(50);
    expect(res.body.data.restaurantName).toBe('CheezyHub');
  });
});

describe('[routes/menu] - POST /api/menu/categories (admin)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 401 without auth', async () => {
    const res = await request(app).post('/api/menu/categories').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('should return 400 for empty category name', async () => {
    const res = await request(app)
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('should create category', async () => {
    mockPrisma.category.create.mockResolvedValue({ id: 'cat-new', name: 'Pizzas' } as any);

    const res = await request(app)
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Pizzas' });
    expect(res.status).toBe(201);
  });

  it('should return 409 for duplicate name', async () => {
    mockPrisma.category.create.mockRejectedValue({ code: 'P2002' });

    const res = await request(app)
      .post('/api/menu/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Burgers' });
    expect(res.status).toBe(409);
  });
});

describe('[routes/menu] - DELETE /api/menu/categories/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 409 if category has items', async () => {
    mockPrisma.menuItem.count.mockResolvedValue(5);

    const res = await request(app)
      .delete('/api/menu/categories/cat-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('5 items');
  });

  it('should soft-delete empty category', async () => {
    mockPrisma.menuItem.count.mockResolvedValue(0);
    mockPrisma.category.update.mockResolvedValue({} as any);

    const res = await request(app)
      .delete('/api/menu/categories/cat-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('[routes/menu] - POST /api/menu/items (admin)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for missing name', async () => {
    const res = await request(app)
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ basePrice: 500, categoryId: 'cat-1' });
    expect(res.status).toBe(400);
  });

  it('should create item with modifier groups', async () => {
    mockPrisma.menuItem.create.mockResolvedValue({
      id: 'item-new', name: 'Deluxe Burger', modifierGroups: [],
    } as any);

    const res = await request(app)
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Deluxe Burger', basePrice: 800, categoryId: 'cat-1',
        modifierGroups: [{ name: 'Size', modifiers: [{ name: 'Large', priceAdjustment: 100 }] }],
      });
    expect(res.status).toBe(201);
  });
});
