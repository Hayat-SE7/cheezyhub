import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../createTestApp';
import { buildStaff, buildOrder, generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    staff: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    order: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    holiday: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    holidayRequest: { findMany: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'h1', status: 'pending' }), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/sseManager', () => ({
  sseManager: {
    broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(),
    broadcastToDelivery: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(),
  },
}));

vi.mock('../../services/whatsapp', () => ({
  whatsappService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/assignmentService', () => ({
  assignDriver: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../config/db';

const mockPrisma = vi.mocked(prisma);
const app = createTestApp();

describe('[Integration] Delivery Flow', () => {
  const driver = buildStaff({ id: 'drv-1', role: 'delivery', username: 'driver1' });
  const driverToken = generateTestToken('drv-1', 'delivery');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.staff.findFirst.mockResolvedValue(driver as any);
    mockPrisma.staff.findUnique.mockResolvedValue(driver as any);
  });

  describe('Status toggle', () => {
    it('should toggle driver status to AVAILABLE', async () => {
      mockPrisma.staff.update.mockResolvedValue({ ...driver, driverStatus: 'AVAILABLE' } as any);

      const res = await request(app)
        .patch('/api/delivery/status')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'AVAILABLE' });

      expect([200, 204]).toContain(res.status);
    });

    it('should toggle driver status to OFFLINE', async () => {
      mockPrisma.staff.update.mockResolvedValue({ ...driver, driverStatus: 'OFFLINE' } as any);

      const res = await request(app)
        .patch('/api/delivery/status')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'OFFLINE' });

      expect([200, 204]).toContain(res.status);
    });
  });

  describe('Active orders', () => {
    it('should return driver active orders', async () => {
      const orders = [buildOrder({ driverId: 'drv-1', status: 'assigned' })];
      mockPrisma.order.findMany.mockResolvedValue(orders as any);

      const res = await request(app)
        .get('/api/delivery/orders')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Location update', () => {
    it('should update driver GPS coordinates', async () => {
      mockPrisma.staff.update.mockResolvedValue({ ...driver, liveLat: 24.86, liveLng: 67.01 } as any);

      const res = await request(app)
        .patch('/api/delivery/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: 24.86, lng: 67.01 });

      expect([200, 204]).toContain(res.status);
    });
  });

  describe('Holiday requests', () => {
    it('should create a holiday request', async () => {
      mockPrisma.holiday.create.mockResolvedValue({ id: 'h1', status: 'pending' } as any);

      const res = await request(app)
        .post('/api/delivery/holidays')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ fromDate: '2026-05-01', toDate: '2026-05-03', reason: 'Family event' });

      expect([200, 201]).toContain(res.status);
    });
  });

  describe('Access control', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/delivery/orders');
      expect(res.status).toBe(401);
    });

    it('should reject non-delivery role', async () => {
      const customerToken = generateTestToken('u1', 'customer');
      const res = await request(app)
        .get('/api/delivery/orders')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
