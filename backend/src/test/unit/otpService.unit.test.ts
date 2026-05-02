import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn() },
}));

import { verifyOtp, completeRegistration, sendOtpViaSms } from '../../services/otpService';
import { prisma } from '../../config/db';
import crypto from 'crypto';

const mockPrisma = vi.mocked(prisma);

function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', process.env.OTP_SECRET!).update(otp).digest('hex');
}

describe('[otpService] - verifyOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify a correct OTP and clear OTP fields', async () => {
    const otp = '123456';
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(Date.now() + 600000),
      otpAttempts: 0,
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await expect(verifyOtp('+923001234567', otp)).resolves.toBeUndefined();

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isVerified: true,
          otpHash: null,
          otpExpiresAt: null,
          otpAttempts: 0,
        }),
      })
    );
  });

  it('should throw for incorrect OTP and increment attempts', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      otpHash: hashOtp('123456'),
      otpExpiresAt: new Date(Date.now() + 600000),
      otpAttempts: 0,
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await expect(verifyOtp('+923001234567', '999999')).rejects.toThrow('Incorrect OTP');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { otpAttempts: 1 },
      })
    );
  });

  it('should throw when no OTP exists for user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
    } as any);

    await expect(verifyOtp('+923001234567', '123456')).rejects.toThrow('No OTP found');
  });

  it('should throw when OTP has expired', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      otpHash: hashOtp('123456'),
      otpExpiresAt: new Date(Date.now() - 1000), // expired
      otpAttempts: 0,
    } as any);

    await expect(verifyOtp('+923001234567', '123456')).rejects.toThrow('OTP expired');
  });

  it('should throw when max attempts reached', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      otpHash: hashOtp('123456'),
      otpExpiresAt: new Date(Date.now() + 600000),
      otpAttempts: 5, // max
    } as any);

    await expect(verifyOtp('+923001234567', '123456')).rejects.toThrow('Too many wrong attempts');
  });

  it('should show remaining attempts in error message', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      otpHash: hashOtp('123456'),
      otpExpiresAt: new Date(Date.now() + 600000),
      otpAttempts: 3,
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await expect(verifyOtp('+923001234567', '000000')).rejects.toThrow('1 attempt left');
  });

  it('should trim whitespace from submitted OTP', async () => {
    const otp = '654321';
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(Date.now() + 600000),
      otpAttempts: 0,
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await expect(verifyOtp('+923001234567', '  654321  ')).resolves.toBeUndefined();
  });
});

describe('[otpService] - completeRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set name and pinHash for verified user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      pinHash: '', // not yet completed
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await completeRegistration('+923001234567', 'John Doe', 'hashedPin123');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'John Doe', pinHash: 'hashedPin123' },
      })
    );
  });

  it('should throw if user is not verified', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      completeRegistration('+923001234567', 'John', 'hash')
    ).rejects.toThrow('Phone not verified');
  });

  it('should silently succeed if already completed (double submit)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      pinHash: 'already-set', // not empty
    } as any);

    await expect(
      completeRegistration('+923001234567', 'John', 'hash')
    ).resolves.toBeUndefined();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should trim name', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      pinHash: '',
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await completeRegistration('+923001234567', '  Jane  ', 'hash');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Jane' }),
      })
    );
  });
});

describe('[otpService] - sendOtpViaSms', () => {
  it('should log OTP in stub mode', async () => {
    process.env.OTP_PROVIDER = 'stub';
    // Should not throw
    await expect(sendOtpViaSms('+923001234567', '123456')).resolves.toBeUndefined();
  });

  it('should throw when twilio_verify is misconfigured', async () => {
    process.env.OTP_PROVIDER = 'twilio_verify';
    delete process.env.TWILIO_SID;
    delete process.env.TWILIO_TOKEN;
    delete process.env.TWILIO_VERIFY_SID;

    await expect(sendOtpViaSms('+923001234567', '123456')).rejects.toThrow('not configured');
    process.env.OTP_PROVIDER = 'stub';
  });

  it('should throw when twilio_sms is misconfigured', async () => {
    process.env.OTP_PROVIDER = 'twilio_sms';
    delete process.env.TWILIO_SID;
    delete process.env.TWILIO_TOKEN;
    delete process.env.TWILIO_SMS_FROM;

    await expect(sendOtpViaSms('+923001234567', '123456')).rejects.toThrow('not configured');
    process.env.OTP_PROVIDER = 'stub';
  });
});
