import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { generateAndStoreOtp, verifyOtp, sendOtpViaSms } from '../services/otpService';

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

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
      );

      res.json({
        success: true,
        data: {
          token,
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

      const token = jwt.sign(
        { userId: staff.id, role: staff.role },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        data: {
          token,
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

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
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
      res.status(500).json({ success: false, error: 'Failed to send OTP' });
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
    // verifyOtp: HMAC comparison, timing-safe, increments attempts, clears on success
    await verifyOtp(mobile, otp);

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
      { expiresIn: '15m' }
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
    payload = jwt.verify(verificationToken, process.env.JWT_SECRET!) as any;
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

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    data: {
      token,
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

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role },
    },
  });
});

// ─── POST /api/auth/reset-pin ─────────────────────────────────────
authRouter.post('/reset-pin', async (req: Request, res: Response) => {
  const schema = z.object({
    identifier: z.string(),
    newPin:     z.string().min(4).max(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid input' });
    return;
  }

  const { identifier, newPin } = parsed.data;
  const user = await prisma.user.findFirst({
    where: { OR: [{ mobile: identifier }, { email: identifier }] },
    select: { id: true }
  });

  if (!user) {
    res.status(404).json({ success: false, error: 'Account not found' });
    return;
  }

  const pinHash = await bcrypt.hash(newPin, BCRYPT_ROUNDS);
  await prisma.user.update({ 
    where: { id: user.id }, 
    data: { pinHash },
    select: { id: true }
  });
  res.json({ success: true, message: 'PIN updated' });
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
