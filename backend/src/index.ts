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
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

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

// ─── Safepay Webhook (MUST be registered BEFORE express.json()) ──
// Safepay sends HMAC-signed webhook payloads that need the raw Buffer
// body for signature verification. express.json() would parse it first.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  safepayWebhookHandler
);

// ─── Parsing ─────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health ──────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// ─── Error Handling ──────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ───────────────────────────────────
app.listen(PORT, () => {
  console.log(`🧀 CheezyHub API running on http://localhost:${PORT}`);
});

export default app;
