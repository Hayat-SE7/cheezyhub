import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { generateAndStoreOtp, verifyOtp, verifyOtpViaTwilio, sendOtpViaSms } from '../services/otpService';
import { issueTokenPair, rotateRefreshToken, revokeRefreshToken } from '../services/tokenService';
import admin from '../config/firebaseAdmin';

export const authRouter = Router();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');

// ─── POST /api/auth/login ─────────────────────────────────────────
// Handles both customers (role:'customer') and staff (role:'staff')
const loginSchema = z.object({
  identifier: z.string().min(1),
  pin:        z.string().min(4).max(8),
  role:       z.enum(['customer', 'staff']).default('customer'),
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid input' });
    return;
  }

  const { identifier, pin, role } = parsed.data;

  try {
    if (role === 'customer') {
      const user = await prisma.user.findFirst({
        where: { OR: [{ mobile: identifier }, { email: identifier }], role: 'customer' },
        select: { id: true, name: true, mobile: true, email: true, pinHash: true, role: true, isBlocked: true },
      });

      if (!user || !(await bcrypt.compare(pin, user.pinHash))) {
        throw new AppError('Invalid credentials', 401);
      }
      if (user.isBlocked) {
        throw new AppError('Account suspended. Please contact support.', 403);
      }

      const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role);

      res.json({
        success: true,
        data: {
          token: accessToken,
          refreshToken,
          user: { id: user.id, name: user.name, mobile: user.mobile, email: user.email, role: user.role },
        },
      });
    } else {
      // Staff: kitchen | delivery | admin | cashier
      const staff = await prisma.staff.findFirst({
        where: { username: identifier, isActive: true },
      });

      if (!staff || !(await bcrypt.compare(pin, staff.pinHash))) {
        throw new AppError('Invalid credentials', 401);
      }

      await prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });

      const { accessToken, refreshToken } = await issueTokenPair(staff.id, staff.role);

      res.json({
        success: true,
        data: {
          token: accessToken,
          refreshToken,
          user: {
            id:       staff.id,
            username: staff.username,
            role:     staff.role,
            fullName: staff.fullName,
            ...(staff.role === 'delivery' && {
              verificationStatus: staff.verificationStatus,
              driverStatus:       staff.driverStatus,
              codPending:         staff.codPending       ?? 0,
              activeOrderCount:   staff.activeOrderCount ?? 0,
              todayDeliveries:    staff.todayDeliveries  ?? 0,
              totalDeliveries:    staff.totalDeliveries  ?? 0,
            }),
          },
        },
      });
    }
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
    } else {
      res.status(500).json({ success: false, error: 'Login failed' });
    }
  }
});

// ─── POST /api/auth/register ──────────────────────────────────────
authRouter.post('/register', async (req: Request, res: Response) => {
  const schema = z.object({
    name:   z.string().min(2),
    mobile: z.string().optional(),
    email:  z.string().email().optional(),
    pin:    z.string().min(4).max(8),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid input' });
    return;
  }

  const { name, mobile, email, pin } = parsed.data;
  if (!mobile && !email) {
    res.status(400).json({ success: false, error: 'Mobile or email required' });
    return;
  }

  try {
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    const user    = await prisma.user.create({
      data: { name, mobile, email, pinHash, role: 'customer' },
      select: { id: true, name: true, mobile: true, email: true, role: true },
    });

    const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role);

    res.status(201).json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, mobile: user.mobile, email: user.email, role: user.role },
      },
    });
  } catch {
    res.status(409).json({ success: false, error: 'Mobile or email already in use' });
  }
});

// ─── POST /api/auth/send-otp ──────────────────────────────────────
// Uses otpService: HMAC-hashed storage, crypto.randomInt, rate limiting
authRouter.post('/send-otp', async (req: Request, res: Response) => {
  const schema = z.object({ mobile: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Mobile number required' });
    return;
  }

  const { mobile } = parsed.data;

  try {
    // generateAndStoreOtp: creates/upserts user, stores HMAC hash, enforces cooldown
    const otp = await generateAndStoreOtp(mobile);

    // Send OTP via configured provider (stub logs to console in dev)
    await sendOtpViaSms(mobile, otp);

    const isProduction = process.env.NODE_ENV === 'production';
    res.json({
      success: true,
      message: 'OTP sent',
      ...(isProduction ? {} : { _devOtp: otp }),
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
    } else {
      console.error('[Auth] OTP send unexpected error:', err);
      res.status(500).json({ success: false, error: 'Failed to send OTP. Please try again later.' });
    }
  }
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────
// Uses otpService: HMAC comparison, timing-safe, attempt limiting
authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  const schema = z.object({
    mobile: z.string(),
    otp:    z.string().length(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Mobile and 6-digit OTP required' });
    return;
  }

  const { mobile, otp } = parsed.data;

  try {
    // Use Twilio Verify's own check when that provider is active,
    // otherwise use local HMAC-based verification
    if (process.env.OTP_PROVIDER === 'twilio_verify') {
      await verifyOtpViaTwilio(mobile, otp);
    } else {
      await verifyOtp(mobile, otp);
    }

    // Find the now-verified user to create the verification token
    const user = await prisma.user.findFirst({ 
      where: { mobile },
      select: { id: true }
    });
    if (!user) {
      res.status(400).json({ success: false, error: 'User not found' });
      return;
    }

    // Return a short-lived token so the client can call /complete-registration
    const verificationToken = jwt.sign(
      { userId: user.id, step: 'otp_verified' },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    res.json({ success: true, data: { verificationToken } });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
    } else {
      res.status(500).json({ success: false, error: 'OTP verification failed' });
    }
  }
});

// ─── POST /api/auth/complete-registration ────────────────────────
authRouter.post('/complete-registration', async (req: Request, res: Response) => {
  const schema = z.object({
    verificationToken: z.string(),
    name:              z.string().min(2),
    pin:               z.string().min(4).max(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid input' });
    return;
  }

  const { verificationToken, name, pin } = parsed.data;

  let payload: { userId: string; step: string };
  try {
    payload = jwt.verify(verificationToken, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as any;
  } catch {
    res.status(400).json({ success: false, error: 'Verification token expired. Please verify your phone again.' });
    return;
  }

  if (payload.step !== 'otp_verified') {
    res.status(400).json({ success: false, error: 'Invalid verification token' });
    return;
  }

  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  const user    = await prisma.user.update({
    where: { id: payload.userId },
    data:  { name, pinHash, isVerified: true },
    select: { id: true, name: true, mobile: true, role: true },
  });

  const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role);

  res.json({
    success: true,
    data: {
      token: accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role },
    },
  });
});

// ─── POST /api/auth/login-pin ─────────────────────────────────────
// Direct mobile + pin login (alternative to OTP flow)
authRouter.post('/login-pin', async (req: Request, res: Response) => {
  const schema = z.object({
    mobile: z.string(),
    pin:    z.string().min(4).max(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid input' });
    return;
  }

  const { mobile, pin } = parsed.data;
  const user = await prisma.user.findFirst({ 
    where: { mobile, role: 'customer' },
    select: { id: true, pinHash: true, isBlocked: true, name: true, mobile: true, role: true }
  });

  if (!user || !user.pinHash || !(await bcrypt.compare(pin, user.pinHash))) {
    res.status(401).json({ success: false, error: 'Invalid mobile or PIN' });
    return;
  }
  if (user.isBlocked) {
    res.status(403).json({ success: false, error: 'Account suspended' });
    return;
  }

  const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role);

  res.json({
    success: true,
    data: {
      token: accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role },
    },
  });
});

// ─── POST /api/auth/refresh ──────────────────────────────────────
// Rotate refresh token and issue new access + refresh pair
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken: oldToken } = req.body;
  if (!oldToken) {
    res.status(400).json({ success: false, error: 'Refresh token required' });
    return;
  }
  try {
    const { accessToken, refreshToken } = await rotateRefreshToken(oldToken);
    res.json({ success: true, data: { token: accessToken, refreshToken } });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
    } else {
      res.status(500).json({ success: false, error: 'Token refresh failed' });
    }
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────
// Revoke refresh token server-side
authRouter.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;
  if (token) {
    await revokeRefreshToken(token);
  }
  res.json({ success: true, message: 'Logged out' });
});

// ─── POST /api/auth/reset-pin ─────────────────────────────────────
// Requires a valid OTP verificationToken (from /verify-otp flow)
authRouter.post('/reset-pin', async (req: Request, res: Response) => {
  const schema = z.object({
    verificationToken: z.string().min(1),
    newPin:            z.string().min(4).max(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid input' });
    return;
  }

  const { verificationToken, newPin } = parsed.data;

  let payload: { userId: string; step: string };
  try {
    payload = jwt.verify(verificationToken, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as any;
  } catch {
    res.status(400).json({ success: false, error: 'Verification token expired. Please verify your phone again.' });
    return;
  }

  if (payload.step !== 'otp_verified') {
    res.status(400).json({ success: false, error: 'Invalid verification token' });
    return;
  }

  const pinHash = await bcrypt.hash(newPin, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: payload.userId },
    data: { pinHash },
    select: { id: true }
  });
  res.json({ success: true, message: 'PIN updated' });
});

// ─── POST /api/auth/firebase-verify ──────────────────────────────
// Verifies a Firebase ID token (from phone auth) and returns a
// verificationToken to use with /complete-registration or /reset-pin
authRouter.post('/firebase-verify', async (req: Request, res: Response) => {
  const schema = z.object({ idToken: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Firebase ID token required' });
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(parsed.data.idToken);
    const phone   = decoded.phone_number;

    if (!phone) {
      res.status(400).json({ success: false, error: 'No phone number in token' });
      return;
    }

    // Upsert a pending user row (same as OTP flow)
    const user = await prisma.user.upsert({
      where:  { mobile: phone },
      create: {
        name: '', mobile: phone, pinHash: '', role: 'customer',
        isVerified: true, otpAttempts: 0,
      },
      update: {
        isVerified: true, otpHash: null, otpExpiresAt: null, otpAttempts: 0,
      },
      select: { id: true, pinHash: true },
    });

    // If user already has a PIN they're registered — issue full tokens
    if (user.pinHash && user.pinHash !== '') {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, mobile: true, role: true },
      });
      const { accessToken, refreshToken } = await issueTokenPair(user.id, 'customer');
      res.json({
        success: true,
        data: {
          status: 'existing_user',
          token: accessToken,
          refreshToken,
          user: fullUser,
        },
      });
      return;
    }

    // New user — return verificationToken for /complete-registration
    const verificationToken = jwt.sign(
      { userId: user.id, step: 'otp_verified' },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    res.json({ success: true, data: { status: 'new_user', verificationToken } });
  } catch (err: any) {
    console.error('[Auth] Firebase verify error:', err.message);
    res.status(401).json({ success: false, error: 'Invalid or expired Firebase token' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { userId, role } = req.user!;

  if (role === 'customer') {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, mobile: true, email: true, role: true, defaultAddressId: true },
    });
    res.json({ success: true, data: user });
  } else {
    const staff = await prisma.staff.findUnique({
      where:  { id: userId },
      select: { id: true, username: true, role: true, fullName: true },
    });
    res.json({ success: true, data: staff });
  }
});
