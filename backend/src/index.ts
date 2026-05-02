import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authRouter } from './routes/auth';
import { menuRouter } from './routes/menu';
import { orderRouter } from './routes/orders';
import { kitchenRouter } from './routes/kitchen';
import { deliveryRouter } from './routes/delivery';
import { adminRouter } from './routes/admin';
import { adminDriverRouter } from './routes/adminDrivers';
import { counterRouter } from './routes/counter';
import { paymentRouter, safepayWebhookHandler } from './routes/payments';
import { ticketRouter } from './routes/tickets';
import { sseRouter } from './routes/sse';
import { dealsRouter } from './routes/deals';
import { addressRouter } from './routes/addresses';
import { favouritesRouter } from './routes/favourites';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { prisma } from './config/db';
import { sseManager } from './services/sseManager';
import { startTimeoutService, stopTimeoutService } from './services/timeoutService';
import { logger } from './config/logger';

// ─── Startup Validation ─────────────────────
import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET:   z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  CORS_ORIGIN:  z.string().min(1, 'CORS_ORIGIN is required'),
  OTP_SECRET:   z.string().min(16, 'OTP_SECRET must be at least 16 characters'),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  for (const issue of envResult.error.issues) {
    logger.fatal(`Env validation failed: ${issue.path.join('.')} — ${issue.message}`);
  }
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security ────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

// ─── Rate Limiting ───────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ─── Auth Rate Limiting (stricter for login) ─
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/login-pin', authLimiter);

// ─── OTP Rate Limiting (per-IP, stricter) ───
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests. Please wait 15 minutes.' },
});
app.use('/api/auth/send-otp', otpLimiter);

// ─── OTP Verify Rate Limiting (prevent brute-force) ─
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification attempts. Please wait 15 minutes.' },
});
app.use('/api/auth/verify-otp', verifyOtpLimiter);

// ─── Safepay Webhook (MUST be registered BEFORE express.json()) ──
// Safepay sends HMAC-signed webhook payloads that need the raw Buffer
// body for signature verification. express.json() would parse it first.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  safepayWebhookHandler
);

// ─── Parsing ─────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request ID ─────────────────────────────
import crypto from 'crypto';
app.use((req, res, next) => {
  (req as any).id = req.headers['x-request-id'] as string ?? crypto.randomUUID();
  res.setHeader('X-Request-Id', (req as any).id);
  next();
});

// ─── Logging ─────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Static file serving for uploads ─────────
import path from 'path';
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ─── Health ──────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// ─── Routes ──────────────────────────────────
app.use('/api/auth',     authRouter);
app.use('/api/menu',     menuRouter);
app.use('/api/orders',   orderRouter);
app.use('/api/counter',  counterRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/kitchen',  kitchenRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/admin',    adminRouter);
app.use('/api/admin',    adminDriverRouter);
app.use('/api/tickets',  ticketRouter);
app.use('/api/sse',      sseRouter);
app.use('/api/deals',    dealsRouter);
app.use('/api/addresses', addressRouter);
app.use('/api/favourites', favouritesRouter);

// ─── Error Handling ──────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ───────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`CheezyHub API running on http://localhost:${PORT}`);
  startTimeoutService();
});

// ─── Request Timeouts (slow-loris protection) ───
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;

// ─── Graceful Shutdown ──────────────────────
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  stopTimeoutService();
  sseManager.closeAll();
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed');
    process.exit(0);
  });
  // Force exit after 10s if drain doesn't complete
  setTimeout(() => process.exit(1), 10_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
