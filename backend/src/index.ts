import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authRouter }     from './routes/auth';
import { menuRouter }     from './routes/menu';
import { orderRouter }    from './routes/orders';
import { kitchenRouter }  from './routes/kitchen';
import { deliveryRouter } from './routes/delivery';
import { adminRouter }    from './routes/admin';
import { ticketRouter }   from './routes/tickets';
import { sseRouter }      from './routes/sse';
import { dealsRouter }    from './routes/deals';
import { paymentRouter, safepayWebhookHandler } from './routes/payments';
import { errorHandler }   from './middleware/errorHandler';
import { notFound }       from './middleware/notFound';

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Security ────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

// ─── Rate Limiting ───────────────────────────────────
const limiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use(limiter);

// ─── Webhook: raw body BEFORE express.json() ─────────
//  Safepay webhook signature verification requires the raw
//  request body (Buffer). Must be registered before JSON parsing.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  safepayWebhookHandler
);

// ─── Parsing ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────────────
app.use('/api/auth',     authRouter);
app.use('/api/menu',     menuRouter);
app.use('/api/orders',   orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/kitchen',  kitchenRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/admin',    adminRouter);
app.use('/api/tickets',  ticketRouter);
app.use('/api/sse',      sseRouter);
app.use('/api/deals',    dealsRouter);

// ─── Error Handling ──────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🧀 CheezyHub API running on http://localhost:${PORT}`);
  console.log(`   PAYMENT_PROVIDER  = ${process.env.PAYMENT_PROVIDER  ?? 'stub'}`);
  console.log(`   WHATSAPP_PROVIDER = ${process.env.WHATSAPP_PROVIDER ?? 'stub'}`);
  console.log(`   OTP_PROVIDER      = ${process.env.OTP_PROVIDER      ?? 'stub'}`);
});

export default app;
