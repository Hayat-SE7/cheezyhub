// ─────────────────────────────────────────────────────
//  TOKEN SERVICE — JWT access + refresh token rotation
//
//  Access token:  short-lived (15min), carries userId + role + jti
//  Refresh token: long-lived (7d), stored hashed in DB, single-use (rotated)
// ─────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues a new access + refresh token pair.
 * Stores the refresh token hash in the database.
 */
export async function issueTokenPair(userId: string, role: string): Promise<TokenPair> {
  const jti = crypto.randomUUID();

  const accessToken = jwt.sign(
    { userId, role, jti },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_EXPIRY }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const hashedRefresh = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      token: hashedRefresh,
      userId,
      role,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Rotates a refresh token: validates the old one, revokes it, issues a new pair.
 * Implements refresh token rotation for security.
 */
export async function rotateRefreshToken(oldRefreshToken: string): Promise<TokenPair> {
  const hashedOld = hashToken(oldRefreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { token: hashedOld },
  });

  if (!stored) {
    throw new AppError('Invalid refresh token', 401);
  }

  if (stored.revokedAt) {
    // Token reuse detected — revoke ALL tokens for this user (security measure)
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError('Refresh token reuse detected. All sessions revoked.', 401);
  }

  if (stored.expiresAt < new Date()) {
    throw new AppError('Refresh token expired', 401);
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  // Issue new pair
  return issueTokenPair(stored.userId, stored.role);
}

/**
 * Revokes a specific refresh token (logout).
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const hashed = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { token: hashed, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes ALL refresh tokens for a user (password change, force logout).
 */
export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
