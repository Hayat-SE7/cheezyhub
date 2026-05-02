/**
 * Creates an Express app for Supertest testing.
 * Mounts specific routers with minimal middleware — no rate limiting, no listen().
 */
import express from 'express';
import { errorHandler } from '../middleware/errorHandler';
import { notFound } from '../middleware/notFound';

import { authRouter } from '../routes/auth';
import { menuRouter } from '../routes/menu';
import { orderRouter } from '../routes/orders';
import { kitchenRouter } from '../routes/kitchen';
import { deliveryRouter } from '../routes/delivery';
import { adminRouter } from '../routes/admin';
import { counterRouter } from '../routes/counter';
import { paymentRouter } from '../routes/payments';
import { dealsRouter } from '../routes/deals';
import { addressRouter } from '../routes/addresses';
import { sseRouter } from '../routes/sse';

export function createTestApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/kitchen', kitchenRouter);
  app.use('/api/delivery', deliveryRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/counter', counterRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/deals', dealsRouter);
  app.use('/api/addresses', addressRouter);
  app.use('/api/sse', sseRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
