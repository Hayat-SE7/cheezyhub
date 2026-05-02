import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verifySafepayWebhook } from '../../services/paymentService';

const WEBHOOK_SECRET = 'test-webhook-secret-for-security';

describe('[Security] - Webhook Security', () => {
  beforeEach(() => {
    process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('should reject replay attack (reused valid signature with different body)', () => {
    const originalBody = Buffer.from('{"event":"payment.completed","id":"pay_1"}');
    const validSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(originalBody)
      .digest('hex');

    // Attacker replays the signature with a different body
    const replayBody = Buffer.from('{"event":"payment.completed","id":"pay_2","amount":0}');
    expect(verifySafepayWebhook(replayBody, validSignature)).toBe(false);
  });

  it('should reject signature with wrong encoding', () => {
    const body = Buffer.from('{"test":true}');
    // Base64 instead of hex
    const wrongEncoding = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('base64');

    expect(verifySafepayWebhook(body, wrongEncoding)).toBe(false);
  });

  it('should reject empty body with any signature', () => {
    const body = Buffer.from('');
    const sig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(Buffer.from('{"malicious":true}'))
      .digest('hex');

    expect(verifySafepayWebhook(body, sig)).toBe(false);
  });

  it('should reject when webhook secret is not configured', () => {
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
    const body = Buffer.from('{"test":true}');
    expect(verifySafepayWebhook(body, 'any-signature')).toBe(false);
  });

  it('should accept valid signature for exact same body', () => {
    const body = Buffer.from('{"event":"payment.completed","data":{"tracker":"trk_123"}}');
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    expect(verifySafepayWebhook(body, signature)).toBe(true);
  });

  it('should use timing-safe comparison to prevent timing attacks', () => {
    const spy = vi.spyOn(crypto, 'timingSafeEqual');
    const body = Buffer.from('{"test":true}');
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    verifySafepayWebhook(body, signature);
    expect(spy).toHaveBeenCalled();
  });
});
