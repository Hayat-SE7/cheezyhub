// ─────────────────────────────────────────────────────
//  OTP SERVICE  v6.1
//
//  Handles generation, storage, delivery and verification
//  of 6-digit OTPs for customer phone registration.
//
//  Security model:
//    • OTPs are 6-digit, cryptographically random
//    • Stored as HMAC-SHA256 (keyed) — never plain text
//    • 10-minute expiry
//    • Max 5 wrong attempts → OTP invalidated, new one required
//    • 60-second cooldown between sends (enforced per phone number)
//
//  Provider is set via OTP_PROVIDER env var:
//    stub          → log to console + return in API (dev only)
//    twilio_verify → Twilio Verify API (recommended)
//    twilio_sms    → plain Twilio SMS
// ─────────────────────────────────────────────────────

import crypto   from 'crypto';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';

// ─── Constants ────────────────────────────────────────

const OTP_EXPIRY_MS       = 10 * 60 * 1000;  // 10 minutes
const OTP_RESEND_COOLDOWN = 60 * 1000;        // 60 seconds between sends
const OTP_MAX_ATTEMPTS    = 5;                // wrong tries before lockout

// ─── Helpers ─────────────────────────────────────────

function generateOtp(): string {
  // crypto.randomInt gives uniform distribution — no modulo bias
  return crypto.randomInt(100_000, 1_000_000).toString();
}

function hashOtp(otp: string): string {
  const secret = process.env.OTP_SECRET ?? 'ch-otp-dev-secret-change-in-prod';
  return crypto.createHmac('sha256', secret).update(otp).digest('hex');
}

// ─── Rate limit check ─────────────────────────────────

async function enforceCooldown(mobile: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where:  { mobile },
    select: { otpLastSentAt: true },
  });

  if (!user?.otpLastSentAt) return; // first time, allow

  const elapsed = Date.now() - user.otpLastSentAt.getTime();
  if (elapsed < OTP_RESEND_COOLDOWN) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN - elapsed) / 1000);
    throw new AppError(`Wait ${wait}s before requesting another OTP.`, 429);
  }
}

// ─── Core: generateAndStoreOtp ────────────────────────

/**
 * Creates a new OTP, saves the hash in the DB, and returns the plain OTP
 * so the caller can send it via SMS.
 *
 * If no user row exists for this mobile yet, one is created in a
 * "pending" state (isVerified=false, empty pinHash).
 * It becomes a real account after the customer completes registration.
 */
export async function generateAndStoreOtp(mobile: string): Promise<string> {
  await enforceCooldown(mobile);

  const otp          = generateOtp();
  const otpHash      = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await prisma.user.upsert({
    where:  { mobile },
    create: {
      name:          '',
      mobile,
      pinHash:       '',
      role:          'customer',
      isVerified:    false,
      otpHash,
      otpExpiresAt,
      otpAttempts:   0,
      otpLastSentAt: new Date(),
    },
    update: {
      otpHash,
      otpExpiresAt,
      otpAttempts:   0,
      otpLastSentAt: new Date(),
    },
    select: { id: true },
  });

  return otp;
}

// ─── Core: verifyOtp ──────────────────────────────────

/**
 * Validates the submitted OTP.
 * On success: marks isVerified=true, clears OTP fields.
 * On failure: increments otpAttempts, throws descriptive AppError.
 */
export async function verifyOtp(mobile: string, submittedOtp: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where:  { mobile },
    select: { id: true, otpHash: true, otpExpiresAt: true, otpAttempts: true },
  });

  if (!user?.otpHash || !user.otpExpiresAt) {
    throw new AppError('No OTP found. Please request a new one.', 400);
  }

  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError('Too many wrong attempts. Please request a new OTP.', 429);
  }

  if (new Date() > user.otpExpiresAt) {
    throw new AppError('OTP expired. Please request a new one.', 400);
  }

  const submittedHash = hashOtp(submittedOtp.trim());

  // timingSafeEqual prevents timing attacks against the 6-digit space
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(submittedHash),
    Buffer.from(user.otpHash)
  );

  if (!isMatch) {
    const newAttempts  = user.otpAttempts + 1;
    const attemptsLeft = OTP_MAX_ATTEMPTS - newAttempts;

    await prisma.user.update({
      where: { id: user.id },
      data:  { otpAttempts: newAttempts },
      select: { id: true },
    });

    throw new AppError(
      attemptsLeft > 0
        ? `Incorrect OTP. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`
        : 'Too many wrong attempts. Please request a new OTP.',
      400
    );
  }

  // ✅ OTP correct — mark verified, clear fields
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      isVerified:   true,
      otpHash:      null,
      otpExpiresAt: null,
      otpAttempts:  0,
    },
    select: { id: true },
  });
}

// ─── Core: completeRegistration ───────────────────────

/**
 * Called after OTP verified. Sets name + PIN on the pending user row.
 * Throws if user isn't verified (registration flow not followed).
 */
export async function completeRegistration(
  mobile:  string,
  name:    string,
  pinHash: string
): Promise<void> {
  const user = await prisma.user.findFirst({
    where:  { mobile, isVerified: true },
    select: { id: true, pinHash: true },
  });

  if (!user) {
    throw new AppError('Phone not verified. Please complete OTP step first.', 400);
  }

  if (user.pinHash !== '') {
    // Already completed — double submit protection, silently OK
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { name: name.trim(), pinHash },
    select: { id: true },
  });
}

// ─── Core: sendOtpViaSms ─────────────────────────────

/**
 * Sends the OTP to the user's phone via the configured provider.
 * In dev (stub), the OTP is also logged to console.
 */
export async function sendOtpViaSms(mobile: string, otp: string): Promise<void> {
  const provider = process.env.OTP_PROVIDER ?? 'stub';

  // ── Twilio Verify ─────────────────────────────────
  // Twilio Verify manages OTP generation + delivery itself.
  // With this provider you don't pass `otp` — Twilio generates it.
  // The flow changes: send-otp hits Twilio Verify, verify-otp checks with Twilio.
  // See: https://www.twilio.com/docs/verify/api
  //
  // Install: npm install twilio
  // Required env vars: TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID
  //
  if (provider === 'twilio_verify') {
    const sid      = process.env.TWILIO_SID;
    const token    = process.env.TWILIO_TOKEN;
    const svcSid   = process.env.TWILIO_VERIFY_SID;

    if (!sid || !token || !svcSid) {
      throw new AppError(
        'Twilio Verify not configured. Need: TWILIO_SID, TWILIO_TOKEN, TWILIO_VERIFY_SID',
        500
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio')(sid, token);
    await twilio.verify.v2
      .services(svcSid)
      .verifications.create({ to: mobile, channel: 'sms' });
    return;
  }

  // ── Twilio plain SMS ──────────────────────────────
  // Sends the OTP in a plain SMS message using your Twilio number.
  // Required env vars: TWILIO_SID, TWILIO_TOKEN, TWILIO_SMS_FROM
  //
  if (provider === 'twilio_sms') {
    const sid   = process.env.TWILIO_SID;
    const token = process.env.TWILIO_TOKEN;
    const from  = process.env.TWILIO_SMS_FROM;

    if (!sid || !token || !from) {
      throw new AppError(
        'Twilio SMS not configured. Need: TWILIO_SID, TWILIO_TOKEN, TWILIO_SMS_FROM',
        500
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio')(sid, token);
    await twilio.messages.create({
      from,
      to:   mobile,
      body: `Your CheezyHub verification code is: ${otp}\n\nValid for 10 minutes. Do not share this code.`,
    });
    return;
  }

  // ── Stub (development default) ────────────────────
  console.log(`\n🔐 [OTP STUB] To: ${mobile}  Code: ${otp}  (valid 10 min)\n`);
}

// ─── Twilio Verify: check code (alternative flow) ────

/**
 * If using twilio_verify provider, verification is done on Twilio's side.
 * Call this instead of the local verifyOtp() when provider === 'twilio_verify'.
 */
export async function verifyOtpViaTwilio(mobile: string, code: string): Promise<void> {
  const sid    = process.env.TWILIO_SID;
  const token  = process.env.TWILIO_TOKEN;
  const svcSid = process.env.TWILIO_VERIFY_SID;

  if (!sid || !token || !svcSid) {
    throw new AppError('Twilio Verify not configured', 500);
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio')(sid, token);
  const check  = await twilio.verify.v2
    .services(svcSid)
    .verificationChecks.create({ to: mobile, code });

  if (check.status !== 'approved') {
    throw new AppError('Incorrect verification code.', 400);
  }

  // Mark verified in our DB
  await prisma.user.upsert({
    where:  { mobile },
    create: {
      name: '', mobile, pinHash: '', role: 'customer',
      isVerified: true, otpAttempts: 0,
    },
    update: {
      isVerified:   true,
      otpHash:      null,
      otpExpiresAt: null,
      otpAttempts:  0,
    },
    select: { id: true },
  });
}
