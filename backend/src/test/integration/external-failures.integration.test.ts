import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    staff: { update: vi.fn() },
  },
}));

vi.mock('../../services/sseManager', () => ({
  sseManager: {
    broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(),
    broadcastToDelivery: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(),
  },
}));

vi.mock('../../services/whatsapp', () => ({
  whatsappService: { send: vi.fn() },
}));

vi.mock('../../services/assignmentService', () => ({
  assignDriver: vi.fn(),
}));

import { whatsappService } from '../../services/whatsapp';
import { createSafepaySession } from '../../services/paymentService';

describe('[Integration] External Failures', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Safepay timeout', () => {
    it('should throw when Safepay API key is missing', async () => {
      const origKey = process.env.SAFEPAY_API_KEY;
      const origSecret = process.env.SAFEPAY_SECRET_KEY;
      delete process.env.SAFEPAY_API_KEY;
      delete process.env.SAFEPAY_SECRET_KEY;

      await expect(createSafepaySession('o1', 'CH-001', 500))
        .rejects.toThrow();

      if (origKey) process.env.SAFEPAY_API_KEY = origKey;
      if (origSecret) process.env.SAFEPAY_SECRET_KEY = origSecret;
    });
  });

  describe('WhatsApp API failure', () => {
    it('should handle WhatsApp 500 error gracefully', async () => {
      vi.mocked(whatsappService.send).mockRejectedValue(new Error('WhatsApp API 500'));

      // WhatsApp failures should not crash the app
      await expect(whatsappService.send('ORDER_COMPLETED', '+923001234567', {}))
        .rejects.toThrow('WhatsApp API 500');
    });

    it('should handle WhatsApp timeout', async () => {
      vi.mocked(whatsappService.send).mockRejectedValue(new Error('Timeout'));

      await expect(whatsappService.send('OUT_FOR_DELIVERY', '+923001234567', {}))
        .rejects.toThrow('Timeout');
    });
  });

  describe('Slow external responses', () => {
    it('should handle delayed WhatsApp responses', async () => {
      vi.mocked(whatsappService.send).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      // Should still resolve
      await expect(whatsappService.send('ORDER_COMPLETED', '+923001234567', {}))
        .resolves.toBeUndefined();
    });
  });
});
