import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verifySafepayWebhook, createStubSession } from '../../services/paymentService';

describe('[paymentService] - verifySafepayWebhook', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret-12345';

  beforeEach(() => {
    process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('should return true for valid signature', () => {
    const body = Buffer.from('{"event":"payment.completed","data":{"order_id":"123"}}');
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    expect(verifySafepayWebhook(body, signature)).toBe(true);
  });

  it('should return false for tampered body', () => {
    const originalBody = Buffer.from('{"event":"payment.completed"}');
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(originalBody)
      .digest('hex');

    const tamperedBody = Buffer.from('{"event":"payment.completed","amount":0}');
    expect(verifySafepayWebhook(tamperedBody, signature)).toBe(false);
  });

  it('should return false for wrong signature', () => {
    const body = Buffer.from('{"event":"payment.completed"}');
    const wrongSignature = crypto
      .createHmac('sha256', 'wrong-secret')
      .update(body)
      .digest('hex');

    expect(verifySafepayWebhook(body, wrongSignature)).toBe(false);
  });

  it('should return false for missing webhook secret', () => {
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
    const body = Buffer.from('test');
    expect(verifySafepayWebhook(body, 'abc')).toBe(false);
  });

  it('should return false for malformed signature (non-hex)', () => {
    const body = Buffer.from('test');
    expect(verifySafepayWebhook(body, 'not-a-hex-string!!!')).toBe(false);
  });

  it('should return false for empty signature', () => {
    const body = Buffer.from('test');
    expect(verifySafepayWebhook(body, '')).toBe(false);
  });

  it('should use timing-safe comparison (no timing attack)', () => {
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

describe('[paymentService] - createStubSession', () => {
  it('should return a tracker and checkout URL', () => {
    const result = createStubSession('order-123', 'CH-001', 1500);
    expect(result.tracker).toContain('stub_tracker_');
    expect(result.checkoutUrl).toContain('/customer/orders');
    expect(result.checkoutUrl).toContain('order-123');
  });

  it('should include order ID in checkout URL', () => {
    const result = createStubSession('abc-def-ghi', 'CH-002', 2000);
    expect(result.checkoutUrl).toContain('abc-def-ghi');
  });

  it('should use FRONTEND_URL env var if set', () => {
    process.env.FRONTEND_URL = 'https://cheezyhub.com';
    const result = createStubSession('order-1', 'CH-003', 500);
    expect(result.checkoutUrl).toContain('https://cheezyhub.com');
    delete process.env.FRONTEND_URL;
  });
});
