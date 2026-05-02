import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    order: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    staff: { findUnique: vi.fn(), update: vi.fn() },
    driverSettlement: { findMany: vi.fn() },
    holidayRequest: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ validateAndPriceOrder: vi.fn(), setItemAvailability: vi.fn(), setModifierAvailability: vi.fn() }));
vi.mock('../../services/uploadService', () => ({
  createUploader: vi.fn().mockReturnValue({ single: vi.fn().mockReturnValue((_req: any, _res: any, next: any) => next()) }),
  getFileUrl: vi.fn().mockReturnValue('http://localhost/uploads/documents/test.jpg'),
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';
import { applyStatusChange } from '../../services/orderLifecycle';
import { sseManager } from '../../services/sseManager';
import { AppError } from '../../middleware/errorHandler';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);
const driverToken = generateTestToken('drv-1', 'delivery');
const customerToken = generateTestToken('cust-1', 'customer');

describe('[routes/delivery] - auth guards', () => {
  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/delivery/orders');
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-delivery role', async () => {
    const res = await request(app)
      .get('/api/delivery/orders')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('[routes/delivery] - GET /api/delivery/orders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return active orders for driver', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'o1', status: 'assigned', driverId: 'drv-1' },
    ] as any);

    const res = await request(app)
      .get('/api/delivery/orders')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('[routes/delivery] - PATCH /api/delivery/orders/:id/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 when status missing', async () => {
    const res = await request(app)
      .patch('/api/delivery/orders/o1/status')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 403 when driver does not own the order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: 'o1', driverId: 'other-driver' } as any);

    const res = await request(app)
      .patch('/api/delivery/orders/o1/status')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'picked_up' });
    expect(res.status).toBe(403);
  });

  it('should update status for owned order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: 'o1', driverId: 'drv-1' } as any);
    vi.mocked(applyStatusChange).mockResolvedValue({ id: 'o1', status: 'picked_up' } as any);

    const res = await request(app)
      .patch('/api/delivery/orders/o1/status')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'picked_up' });
    expect(res.status).toBe(200);
  });
});

describe('[routes/delivery] - PATCH /api/delivery/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/delivery/status')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'BUSY' });
    expect(res.status).toBe(400);
  });

  it('should toggle driver status and broadcast', async () => {
    mockPrisma.staff.update.mockResolvedValue({ id: 'drv-1', driverStatus: 'AVAILABLE' } as any);

    const res = await request(app)
      .patch('/api/delivery/status')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'AVAILABLE' });
    expect(res.status).toBe(200);
    expect(sseManager.broadcastToAdmin).toHaveBeenCalledWith('DRIVER_STATUS_CHANGED', expect.any(Object));
  });
});

describe('[routes/delivery] - PATCH /api/delivery/location', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for non-numeric lat/lng', async () => {
    const res = await request(app)
      .patch('/api/delivery/location')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ lat: 'abc', lng: 67.0 });
    expect(res.status).toBe(400);
  });

  it('should update location', async () => {
    mockPrisma.staff.update.mockResolvedValue({} as any);

    const res = await request(app)
      .patch('/api/delivery/location')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ lat: 24.86, lng: 67.01 });
    expect(res.status).toBe(200);
  });
});

describe('[routes/delivery] - holidays', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /holidays should return 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/delivery/holidays')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ fromDate: '2026-05-01' });
    expect(res.status).toBe(400);
  });

  it('POST /holidays should return 400 when from >= to', async () => {
    const res = await request(app)
      .post('/api/delivery/holidays')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ fromDate: '2026-05-05', toDate: '2026-05-01', reason: 'vacation' });
    expect(res.status).toBe(400);
  });

  it('POST /holidays should create holiday request', async () => {
    mockPrisma.holidayRequest.create.mockResolvedValue({ id: 'h1' } as any);

    const res = await request(app)
      .post('/api/delivery/holidays')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ fromDate: '2026-05-01', toDate: '2026-05-05', reason: 'vacation' });
    expect(res.status).toBe(201);
  });

  it('PATCH /holidays/:id should return 403 for other driver', async () => {
    mockPrisma.holidayRequest.findUnique.mockResolvedValue({ id: 'h1', driverId: 'other', status: 'PENDING' } as any);

    const res = await request(app)
      .patch('/api/delivery/holidays/h1')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(403);
  });
});
