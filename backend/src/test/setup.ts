import { vi, beforeEach, afterEach } from 'vitest';

// ── Environment variables for tests ──────────────────
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env.OTP_SECRET = 'test-otp-secret-at-least-16';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/cheezyhub_test';
process.env.PAYMENT_PROVIDER = 'stub';
process.env.OTP_PROVIDER = 'stub';

// ── Clear all mocks between tests ────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
