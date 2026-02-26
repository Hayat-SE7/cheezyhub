// ─────────────────────────────────────────────────────
//  AUTH ROUTE  v6.1
//
//  Customer registration — 3-step OTP flow:
//    1. POST /api/auth/send-otp             → sends OTP to phone
//    2. POST /api/auth/verify-otp           → verifies code, returns verificationToken
//    3. POST /api/auth/complete-registration→ sets name + PIN, returns JWT
//
//  Customer login (after registration):
//    POST /api/auth/login  (role: "customer") → mobile/email + PIN
//
//  Staff login (unchanged):
//    POST /api/auth/login  (role: "staff")    → username + PIN
// ─────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import {
  generateAndStoreOtp,
  sendOtpViaSms,
  verifyOtp,
  verifyOtpViaTwilio,
  completeRegistration,
} from '../services/otpService';

export const authRouter = Router();

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');
const IS_DEV = process.env.NODE_ENV !== 'production';

function issueJwt(userId: string, role: string, expiresIn = '7d'): string {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!, { expiresIn } as any);
}

// ─────────────────────────────────────────────────────
//  POST /api/auth/send-otp
//  Step 1: customer enters phone number → we send OTP.
//  In dev mode, OTP is returned in the response body (_devOtp).
// ─────────────────────────────────────────────────────

authRouter.post('/send-otp', async (req: Request, res: Response) => {
  const schema = z.object({
    mobile: z
      .string()
      .min(7, 'Invalid phone number')
      .max(15, 'Invalid phone number')
      .regex(/^\+?[0-9]+$/, 'Phone must contain digits only'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const mobile = parsed.data.mobile.startsWith('+')
    ? parsed.data.mobile
    : `+${parsed.data.mobile}`;

  // Block if a completed account already exists for this number
  const existing = await prisma.user.findFirst({
    where:  { mobile, isVerified: true, NOT: { pinHash: '' } },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({
      success: false,
      error:   'An account with this number already exists. Please sign in instead.',
    });
    return;
  }

  try {
    const otp = await generateAndStoreOtp(mobile);
    await sendOtpViaSms(mobile, otp);

    const data: Record<string, any> = {
      success: true,
      message: 'OTP sent! Check your messages.',
    };

    // DEV ONLY — never do this in production
    if (IS_DEV) {
      data._devOtp  = otp;
      data._devNote = 'OTP included only in development mode.';
    }

    res.json(data);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
    } else {
      console.error('[Auth/send-otp]', err);
      res.status(500).json({ success: false, error: 'Failed to send OTP. Try again.' });
    }
  }
});

// ─────────────────────────────────────────────────────
//  POST /api/auth/verify-otp
//  Step 2: customer submits 6-digit code.
//  On success: returns a short-lived verificationToken (5 min)
//  that proves the phone was verified — required for step 3.
// ─────────────────────────────────────────────────────

authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  const schema = z.object({
    mobile: z.string().min(7).max(15),
    otp:    z.string().length(6, 'OTP is 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const mobile = parsed.data.mobile.startsWith('+')
    ? parsed.data.mobile
    : `+${parsed.data.mobile}`;

  try {
    // Use Twilio Verify's own check if that provider is active
    if (process.env.OTP_PROVIDER === 'twilio_verify') {
      await verifyOtpViaTwilio(mobile, parsed.data.otp);
    } else {
      await verifyOtp(mobile, parsed.data.otp);
    }

    // Short-lived proof token — expires in 5 minutes
    const verificationToken = jwt.sign(
      { mobile, purpose: 'registration' },
      process.env.JWT_SECRET!,
      { expiresIn: '5m' } as any
    );

    res.json({
      success: true,
      message: 'Phone verified! Set your name and PIN.',
      data:    { verificationToken },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
    } else {
      res.status(500).json({ success: false, error: 'Verification failed. Try again.' });
    }
  }
});

// ─────────────────────────────────────────────────────
//  POST /api/auth/complete-registration
//  Step 3: customer sets name and PIN.
//  Requires the verificationToken from step 2.
//  Returns a full JWT — customer is now logged in.
// ─────────────────────────────────────────────────────

authRouter.post('/complete-registration', async (req: Request, res: Response) => {
  const schema = z.object({
    verificationToken: z.string().min(1, 'Verification token required'),
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name too long')
      .regex(/^[^\d]/, 'Name cannot start with a number'),
    pin: z
      .string()
      .min(4, 'PIN must be at least 4 digits')
      .max(8, 'PIN max 8 digits')
      .regex(/^\d+$/, 'PIN must be numeric'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const { verificationToken, name, pin } = parsed.data;

  // Validate the short-lived verification token
  let decoded: { mobile: string; purpose: string };
  try {
    decoded = jwt.verify(verificationToken, process.env.JWT_SECRET!) as {
      mobile: string;
      purpose: string;
    };
  } catch {
    res.status(400).json({
      success: false,
      error:   'Verification session expired. Please verify your phone again.',
    });
    return;
  }

  if (decoded.purpose !== 'registration') {
    res.status(400).json({ success: false, error: 'Invalid token.' });
    return;
  }

  try {
    const pinHash = await bcrypt.hash(pin, ROUNDS);
    await completeRegistration(decoded.mobile, name, pinHash);

    const user = await prisma.user.findFirst({
      where:  { mobile: decoded.mobile, isVerified: true },
      select: { id: true, name: true, mobile: true, email: true, role: true },
    });

    if (!user) {
      res.status(500).json({ success: false, error: 'Registration error. Try again.' });
      return;
    }

    res.status(201).json({
      success: true,
      data:    { token: issueJwt(user.id, user.role), user },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, error: err.message });
    } else {
      console.error('[Auth/complete-registration]', err);
      res.status(409).json({ success: false, error: 'Registration failed. Try again.' });
    }
  }
});

// ─────────────────────────────────────────────────────
//  POST /api/auth/login
//  Customer: mobile/email + PIN. Must be verified + have a PIN set.
//  Staff:    username + PIN (kitchen/delivery/admin).
// ─────────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  const schema = z.object({
    identifier: z.string().min(1),
    pin:        z.string().min(4).max(8),
    role:       z.enum(['customer', 'staff']).default('customer'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid input' });
    return;
  }

  const { identifier, pin, role } = parsed.data;

  try {
    if (role === 'customer') {
      const user = await prisma.user.findFirst({
        where: {
          OR:          [{ mobile: identifier }, { email: identifier }],
          role:        'customer',
          isVerified:  true,
          NOT:         { pinHash: '' },
        },
      });

      if (!user || !(await bcrypt.compare(pin, user.pinHash))) {
        throw new AppError('Invalid credentials', 401);
      }

      res.json({
        success: true,
        data: {
          token: issueJwt(user.id, user.role),
          user:  { id: user.id, name: user.name, mobile: user.mobile, email: user.email, role: user.role },
          role:  user.role,
        },
      });

    } else {
      const staff = await prisma.staff.findFirst({
        where: { username: identifier, isActive: true },
      });

      if (!staff || !(await bcrypt.compare(pin, staff.pinHash))) {
        throw new AppError('Invalid credentials', 401);
      }

      res.json({
        success: true,
        data: {
          token: issueJwt(staff.id, staff.role, '24h'),
          user:  { id: staff.id, username: staff.username, role: staff.role },
          role:  staff.role,
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
