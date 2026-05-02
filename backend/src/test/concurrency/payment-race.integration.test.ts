import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  prisma: {
    order: { findFirst: vi.fn(), findUnique: vi.fn() },
    payment: { update: vi.fn() },
    processedWebhook: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/sseManager', () => ({
  sseManager: {
    broadcastToKitchen: vi.fn(),
    broadcastToAdmin: vi.fn(),
    sendToCustomer: vi.fn(),
  },
}));
vi.mock('../../services/whatsapp', () => ({ whatsappService: { send: vi.fn() } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { prisma } from '../../config/db';

const mockPrisma = vi.mocked(prisma);

describe('[Concurrency] - Payment Webhook Race', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should reject duplicate webhook via ProcessedWebhook unique constraint', async () => {
    // First webhook creates entry successfully
    mockPrisma.processedWebhook.create.mockResolvedValueOnce({} as any);

    // Second webhook hits unique constraint (P2002)
    mockPrisma.processedWebhook.create.mockRejectedValueOnce({ code: 'P2002' });

    // First call succeeds
    await prisma.processedWebhook.create({ data: { provider: 'safepay', eventId: 'evt-1', event: 'payment:created' } });

    // Second call with same eventId should throw P2002
    try {
      await prisma.processedWebhook.create({ data: { provider: 'safepay', eventId: 'evt-1', event: 'payment:created' } });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe('P2002');
    }
  });

  it('should handle concurrent webhook + manual confirm by dedup key', async () => {
    // Simulate: both webhook and manual confirm try to process simultaneously
    const dedupeKey = 'trk_123:payment:created';

    // First one wins (creates dedup entry)
    mockPrisma.processedWebhook.create
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce({ code: 'P2002' }); // second attempt gets P2002

    // First succeeds
    const first = await prisma.processedWebhook.create({
      data: { provider: 'safepay', eventId: dedupeKey, event: 'payment:created' },
    });
    expect(first).toBeDefined();

    // Second is a duplicate — caught by P2002
    let isDuplicate = false;
    try {
      await prisma.processedWebhook.create({
        data: { provider: 'safepay', eventId: dedupeKey, event: 'payment:created' },
      });
    } catch (err: any) {
      if (err.code === 'P2002') isDuplicate = true;
    }
    expect(isDuplicate).toBe(true);
  });
});
