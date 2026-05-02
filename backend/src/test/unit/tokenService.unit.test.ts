import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../config/db', () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { issueTokenPair, rotateRefreshToken, revokeRefreshToken, revokeAllForUser } from '../../services/tokenService';
import { prisma } from '../../config/db';

const mockPrisma = vi.mocked(prisma);
const JWT_SECRET = process.env.JWT_SECRET!;

describe('[tokenService] - issueTokenPair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.refreshToken.create.mockResolvedValue({} as any);
  });

  it('should return an access token and refresh token', async () => {
    const pair = await issueTokenPair('user-1', 'customer');
    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
    expect(typeof pair.accessToken).toBe('string');
    expect(typeof pair.refreshToken).toBe('string');
  });

  it('should create a valid JWT access token with userId and role', async () => {
    const pair = await issueTokenPair('user-1', 'admin');
    const decoded = jwt.verify(pair.accessToken, JWT_SECRET) as any;
    expect(decoded.userId).toBe('user-1');
    expect(decoded.role).toBe('admin');
    expect(decoded.jti).toBeTruthy();
  });

  it('should store hashed refresh token in database', async () => {
    await issueTokenPair('user-1', 'customer');
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
    const call = mockPrisma.refreshToken.create.mock.calls[0][0];
    expect(call.data.userId).toBe('user-1');
    expect(call.data.role).toBe('customer');
    expect(call.data.token).not.toContain('user-1'); // hashed, not plain
  });

  it('should set expiry ~7 days in the future', async () => {
    await issueTokenPair('user-1', 'customer');
    const call = mockPrisma.refreshToken.create.mock.calls[0][0];
    const expiry = new Date(call.data.expiresAt).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expiry - Date.now()).toBeGreaterThan(sevenDays - 10000);
    expect(expiry - Date.now()).toBeLessThan(sevenDays + 10000);
  });
});

describe('[tokenService] - rotateRefreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.refreshToken.create.mockResolvedValue({} as any);
  });

  it('should throw for invalid (nonexistent) refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(rotateRefreshToken('bad-token')).rejects.toThrow('Invalid refresh token');
  });

  it('should throw and revoke all tokens if reused (already revoked)', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      role: 'customer',
      revokedAt: new Date(), // already revoked = reuse
      expiresAt: new Date(Date.now() + 86400000),
    } as any);
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 5 } as any);

    await expect(rotateRefreshToken('reused-token')).rejects.toThrow('reuse detected');
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', revokedAt: null }),
      })
    );
  });

  it('should throw for expired refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      role: 'customer',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 86400000), // expired
    } as any);

    await expect(rotateRefreshToken('expired-token')).rejects.toThrow('expired');
  });

  it('should revoke old token and issue new pair for valid token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      role: 'admin',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    } as any);
    mockPrisma.refreshToken.update.mockResolvedValue({} as any);

    const pair = await rotateRefreshToken('valid-token');
    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt-1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
  });
});

describe('[tokenService] - revokeRefreshToken', () => {
  it('should revoke the given token', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 } as any);
    await revokeRefreshToken('some-token');
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
  });
});

describe('[tokenService] - revokeAllForUser', () => {
  it('should revoke all non-revoked tokens for a user', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 } as any);
    await revokeAllForUser('user-1');
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', revokedAt: null },
      })
    );
  });
});
