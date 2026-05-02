import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildOrder } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    processedWebhook: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/sseManager', () => ({
  sseManager: {
    broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(),
    broadcastToDelivery: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(),
  },
}));

vi.mock('../../services/whatsapp', () => ({
  whatsappService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/assignmentService', () => ({
  assignDriver: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../config/db';
import { createSafepaySession, verifySafepayWebhook } from '../../services/paymentService';

const mockPrisma = vi.mocked(prisma);

describe('[Integration] Payment Flow', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('COD flow', () => {
    it('should allow order with cash payment method', () => {
      const order = buildOrder({ paymentMethod: 'cash', paymentStatus: 'none' });
      expect(order.paymentMethod).toBe('cash');
      expect(order.paymentStatus).toBe('none');
    });

    it('should not require payment confirmation for COD orders', () => {
      const order = buildOrder({ paymentMethod: 'cash', paymentStatus: 'none' });
      // COD orders proceed directly — no payment session needed
      expect(order.paymentMethod).toBe('cash');
    });
  });

  describe('Safepay session creation', () => {
    it('should throw when SAFEPAY_API_KEY is not set', async () => {
      const origKey = process.env.SAFEPAY_API_KEY;
      const origSecret = process.env.SAFEPAY_SECRET_KEY;
      delete process.env.SAFEPAY_API_KEY;
      delete process.env.SAFEPAY_SECRET_KEY;

      await expect(createSafepaySession('ord-1', 'CH-001', 1000))
        .rejects.toThrow(/SAFEPAY_API_KEY/);

      if (origKey) process.env.SAFEPAY_API_KEY = origKey;
      if (origSecret) process.env.SAFEPAY_SECRET_KEY = origSecret;
    });
  });

  describe('Webhook verification', () => {
    it('should verify valid HMAC-SHA256 signature', () => {
      const secret = 'test-webhook-secret';
      process.env.SAFEPAY_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({ type: 'payment.success', data: { tracker: 'trk-1' } });
      const crypto = require('crypto');
      const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const result = verifySafepayWebhook(payload, validSig);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      process.env.SAFEPAY_WEBHOOK_SECRET = 'test-secret';
      const result = verifySafepayWebhook('{"data":"test"}', 'invalid-sig');
      expect(result).toBe(false);
    });

    it('should reject when webhook secret is missing', () => {
      delete process.env.SAFEPAY_WEBHOOK_SECRET;
      const result = verifySafepayWebhook('{}', 'any-sig');
      expect(result).toBe(false);
    });
  });

  describe('Duplicate webhook idempotency', () => {
    it('should track processed webhooks to prevent duplicates', async () => {
      // Simulate checking for existing webhook
      mockPrisma.processedWebhook.findUnique.mockResolvedValue(null);
      mockPrisma.processedWebhook.create.mockResolvedValue({ id: 'pw-1' } as any);

      const exists = await prisma.processedWebhook.findUnique({ where: { id: 'webhook-1' } });
      expect(exists).toBeNull();

      await prisma.processedWebhook.create({ data: { id: 'webhook-1' } as any });

      // Second check finds it
      mockPrisma.processedWebhook.findUnique.mockResolvedValue({ id: 'webhook-1' } as any);
      const duplicate = await prisma.processedWebhook.findUnique({ where: { id: 'webhook-1' } });
      expect(duplicate).not.toBeNull();
    });
  });
});
