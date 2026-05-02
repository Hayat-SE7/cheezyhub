import { describe, it, expect, vi } from 'vitest';

// Rate limiting is typically applied at the app level (express-rate-limit in index.ts).
// Since createTestApp does NOT include rate limiters (by design for unit tests),
// these tests verify the rate-limit middleware logic in isolation.

vi.mock('../../config/db', () => ({
  prisma: {
    user: { findFirst: vi.fn() },
    staff: { findFirst: vi.fn() },
    refreshToken: { create: vi.fn() },
  },
}));
vi.mock('../../services/tokenService', () => ({
  issueTokenPair: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  rotateRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
}));
vi.mock('../../services/otpService', () => ({
  generateAndStoreOtp: vi.fn(),
  verifyOtp: vi.fn(),
  verifyOtpViaTwilio: vi.fn(),
  sendOtpViaSms: vi.fn(),
}));
vi.mock('../../config/firebaseAdmin', () => ({ default: { auth: () => ({ verifyIdToken: vi.fn() }) } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ validateAndPriceOrder: vi.fn(), setItemAvailability: vi.fn(), setModifierAvailability: vi.fn() }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { authRouter } from '../../routes/auth';
import { AppError } from '../../middleware/errorHandler';
import { generateAndStoreOtp, sendOtpViaSms } from '../../services/otpService';

describe('[Security] - Rate Limiting', () => {
  it('should return 429 after exceeding login rate limit', async () => {
    // Create a mini app with tight rate limiting for testing
    const app = express();
    app.use(express.json());

    const loginLimiter = rateLimit({
      windowMs: 60_000,
      max: 3, // 3 attempts per minute
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many attempts. Try again later.' },
    });

    app.use('/api/auth', loginLimiter, authRouter);

    // Make 3 requests (allowed)
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').send({
        identifier: 'test@test.com', pin: '1234', role: 'customer',
      });
    }

    // 4th request should be rate limited
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'test@test.com', pin: '1234', role: 'customer',
    });

    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Too many');
  });

  it('should return 429 after exceeding OTP send rate limit', async () => {
    const app = express();
    app.use(express.json());

    const otpLimiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      message: { success: false, error: 'Too many OTP requests. Wait a minute.' },
    });

    app.use('/api/auth', otpLimiter, authRouter);

    vi.mocked(generateAndStoreOtp).mockResolvedValue('123456');
    vi.mocked(sendOtpViaSms).mockResolvedValue(undefined);

    // Make 2 requests (allowed)
    for (let i = 0; i < 2; i++) {
      await request(app).post('/api/auth/send-otp').send({ mobile: '+923001234567' });
    }

    // 3rd request should be rate limited
    const res = await request(app).post('/api/auth/send-otp').send({ mobile: '+923001234567' });
    expect(res.status).toBe(429);
  });

  it('should include rate limit headers in response', async () => {
    const app = express();
    app.use(express.json());

    const limiter = rateLimit({
      windowMs: 60_000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
    });

    app.use('/api/auth', limiter, authRouter);

    const res = await request(app).post('/api/auth/login').send({
      identifier: 'test@test.com', pin: '1234', role: 'customer',
    });

    // Standard RateLimit headers
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });
});
