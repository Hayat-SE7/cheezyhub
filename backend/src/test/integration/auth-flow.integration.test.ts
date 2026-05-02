import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../createTestApp';
import { buildUser, generateTestToken, generateExpiredToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    user: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    staff: { findFirst: vi.fn() },
    refreshToken: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    order: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/sseManager', () => ({
  sseManager: {
    broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(),
    broadcastToDelivery: vi.fn(), sendToCustomer: vi.fn(), addClient: vi.fn(),
    storeEvent: vi.fn(), replayEvents: vi.fn(),
  },
}));

vi.mock('../../services/otpService', () => ({
  generateOTP: vi.fn().mockReturnValue({ hash: 'otp-hash', plain: '123456' }),
  verifyOTP: vi.fn().mockReturnValue(true),
}));

import { prisma } from '../../config/db';
import bcrypt from 'bcryptjs';

const mockPrisma = vi.mocked(prisma);
const app = createTestApp();

describe('[Integration] Auth Flow', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const pinHash = await bcrypt.hash('1234', 10);
      const user = buildUser({ id: 'u1', pinHash, mobile: '+923001234567' });

      mockPrisma.user.findFirst.mockResolvedValue(user as any);
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1', token: 'refresh-tok' } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: '+923001234567', pin: '1234', role: 'customer' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject invalid PIN', async () => {
      const pinHash = await bcrypt.hash('1234', 10);
      const user = buildUser({ id: 'u1', pinHash });
      mockPrisma.user.findFirst.mockResolvedValue(user as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: '+923001234567', pin: '0000', role: 'customer' });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'nonexistent@test.com', pin: '1234', role: 'customer' });

      expect(res.status).toBe(401);
    });
  });

  describe('Token validation', () => {
    it('should reject requests without token', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(401);
    });

    it('should reject expired token', async () => {
      const expiredToken = generateExpiredToken('u1', 'customer');
      // Small delay to ensure token is expired
      await new Promise((r) => setTimeout(r, 50));

      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject malformed token', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });
  });
});
