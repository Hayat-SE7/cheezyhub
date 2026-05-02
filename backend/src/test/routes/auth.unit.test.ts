import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock all external deps
vi.mock('../../config/db', () => ({
  prisma: {
    user: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    staff: { findFirst: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock('../../services/otpService', () => ({
  generateAndStoreOtp: vi.fn(),
  verifyOtp: vi.fn(),
  verifyOtpViaTwilio: vi.fn(),
  sendOtpViaSms: vi.fn(),
}));
vi.mock('../../services/tokenService', () => ({
  issueTokenPair: vi.fn().mockResolvedValue({ accessToken: 'acc-tok', refreshToken: 'ref-tok' }),
  rotateRefreshToken: vi.fn().mockResolvedValue({ accessToken: 'new-acc', refreshToken: 'new-ref' }),
  revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../config/firebaseAdmin', () => ({
  default: { auth: () => ({ verifyIdToken: vi.fn() }) },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));

import { createTestApp } from '../createTestApp';
import { prisma } from '../../config/db';
import { issueTokenPair, rotateRefreshToken } from '../../services/tokenService';
import { generateAndStoreOtp, sendOtpViaSms, verifyOtp } from '../../services/otpService';
import { AppError } from '../../middleware/errorHandler';

const app = createTestApp();
const mockPrisma = vi.mocked(prisma);

describe('[routes/auth] - POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for invalid input', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for wrong customer credentials', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/login').send({
      identifier: '+923001234567', pin: '1234', role: 'customer',
    });
    expect(res.status).toBe(401);
  });

  it('should login customer successfully', async () => {
    const pinHash = await bcrypt.hash('1234', 10);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u1', name: 'Test', mobile: '+923001234567', email: null, pinHash, role: 'customer', isBlocked: false,
    } as any);

    const res = await request(app).post('/api/auth/login').send({
      identifier: '+923001234567', pin: '1234', role: 'customer',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('acc-tok');
    expect(res.body.data.refreshToken).toBe('ref-tok');
  });

  it('should return 403 for blocked customer', async () => {
    const pinHash = await bcrypt.hash('1234', 10);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'u1', name: 'Blocked', mobile: '+923001234567', email: null, pinHash, role: 'customer', isBlocked: true,
    } as any);

    const res = await request(app).post('/api/auth/login').send({
      identifier: '+923001234567', pin: '1234', role: 'customer',
    });
    expect(res.status).toBe(403);
  });

  it('should login staff successfully', async () => {
    const pinHash = await bcrypt.hash('5678', 10);
    mockPrisma.staff.findFirst.mockResolvedValue({
      id: 's1', username: 'chef', pinHash, role: 'kitchen', isActive: true, fullName: 'Chef Test',
    } as any);
    mockPrisma.staff.update.mockResolvedValue({} as any);

    const res = await request(app).post('/api/auth/login').send({
      identifier: 'chef', pin: '5678', role: 'staff',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('kitchen');
  });
});

describe('[routes/auth] - POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for missing mobile and email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test', pin: '1234',
    });
    expect(res.status).toBe(400);
  });

  it('should create customer and return tokens', async () => {
    mockPrisma.user.create.mockResolvedValue({
      id: 'u2', name: 'New User', mobile: '+923009999999', email: null, role: 'customer',
    } as any);

    const res = await request(app).post('/api/auth/register').send({
      name: 'New User', mobile: '+923009999999', pin: '1234',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBe('acc-tok');
  });

  it('should return 409 for duplicate mobile', async () => {
    mockPrisma.user.create.mockRejectedValue(new Error('unique constraint'));

    const res = await request(app).post('/api/auth/register').send({
      name: 'Dup', mobile: '+923001234567', pin: '1234',
    });
    expect(res.status).toBe(409);
  });
});

describe('[routes/auth] - POST /api/auth/send-otp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for missing mobile', async () => {
    const res = await request(app).post('/api/auth/send-otp').send({});
    expect(res.status).toBe(400);
  });

  it('should send OTP successfully', async () => {
    vi.mocked(generateAndStoreOtp).mockResolvedValue('123456');
    vi.mocked(sendOtpViaSms).mockResolvedValue(undefined);

    const res = await request(app).post('/api/auth/send-otp').send({ mobile: '+923001234567' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('[routes/auth] - POST /api/auth/verify-otp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 for invalid OTP format', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ mobile: '+923001234567', otp: '12' });
    expect(res.status).toBe(400);
  });

  it('should return verification token on success', async () => {
    vi.mocked(verifyOtp).mockResolvedValue(undefined);
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' } as any);

    const res = await request(app).post('/api/auth/verify-otp').send({
      mobile: '+923001234567', otp: '123456',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verificationToken).toBeDefined();
  });
});

describe('[routes/auth] - POST /api/auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return 400 without refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('should return new token pair', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'old-ref' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('new-acc');
  });

  it('should return 401 for invalid refresh token', async () => {
    vi.mocked(rotateRefreshToken).mockRejectedValue(new AppError('Invalid refresh token', 401));

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'bad' });
    expect(res.status).toBe(401);
  });
});

describe('[routes/auth] - POST /api/auth/logout', () => {
  it('should return success even without token', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
