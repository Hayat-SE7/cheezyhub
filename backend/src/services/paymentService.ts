// ─────────────────────────────────────────────────────
//  PAYMENT SERVICE  v6.1
//
//  Provider: Safepay (getsafepay.com) — covers:
//    ✅ JazzCash wallet + mobile OTP
//    ✅ EasyPaisa wallet + mobile OTP
//    ✅ All Pakistani bank cards (Visa, Mastercard, UnionPay)
//    ✅ HBL, MCB, UBL, Meezan internet banking
//    ✅ PKR currency (no conversion needed)
//
//  Provider switch: PAYMENT_PROVIDER env var
//    stub    → console log only (dev default)
//    safepay → Safepay live/sandbox
//
//  ─── Safepay Setup ───────────────────────────────
//  1. Sign up at getsafepay.com
//  2. Go to Dashboard → Developers → API Keys
//  3. Get your Secret Key (sandbox + production are separate)
//  4. For webhooks: Dashboard → Developers → Webhooks
//     Add endpoint: https://yourapi.com/api/payments/webhook
//     Copy the webhook secret shown after saving
//
//  ─── Safepay Sandbox ─────────────────────────────
//  Base URL:    https://sandbox.api.getsafepay.com
//  Checkout:    https://sandbox.getsafepay.com/checkout/pay
//  Test cards:  Visa 4111 1111 1111 1111  CVV: 123  Exp: any future date
//  JazzCash:    Use test MSISDN provided in Safepay sandbox docs
//
//  ─── Safepay Production ──────────────────────────
//  Base URL:    https://api.getsafepay.com
//  Checkout:    https://getsafepay.com/checkout/pay
// ─────────────────────────────────────────────────────

import crypto from 'crypto';

export interface SafepaySession {
  tracker: string;    // Safepay tracker token — store on order
  checkoutUrl: string; // Redirect customer here
}

// ─── Safepay: Create Payment Session ──────────────────

/**
 * Creates a Safepay payment session.
 * Returns the tracker token and the checkout URL to redirect the customer.
 *
 * Required env vars:
 *   SAFEPAY_SECRET_KEY   — from Safepay Dashboard → Developers → API Keys
 *   SAFEPAY_ENVIRONMENT  — "sandbox" or "production" (default: "sandbox")
 *   FRONTEND_URL         — for redirect URLs after payment
 */
export async function createSafepaySession(
  orderId: string,
  orderNumber: string,
  amountPKR: number
): Promise<SafepaySession> {
  const secretKey = process.env.SAFEPAY_API_KEY ?? process.env.SAFEPAY_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'SAFEPAY_API_KEY not set. Get it from getsafepay.com Dashboard → Developers → API Keys (format: sec_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)'
    );
  }

  const env         = process.env.SAFEPAY_ENVIRONMENT ?? 'sandbox';
  const isSandbox   = env === 'sandbox';
  const apiBase     = isSandbox
    ? 'https://sandbox.api.getsafepay.com'
    : 'https://api.getsafepay.com';
  const checkoutBase = isSandbox
    ? 'https://sandbox.api.getsafepay.com'
    : 'https://getsafepay.com';

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  // ── Step 1: Init payment to get tracker token ──────
  //
  // POST /order/v1/init
  // Body: { client, environment, currency, amount }
  //   client      — API key from Dashboard (format: sec_uuid)
  //   environment — "sandbox" or "production"
  //   amount      — in PKR (e.g. 1500.00)
  // Response: { data: { token: "tracker_xxx" } }
  const initResponse = await fetch(`${apiBase}/order/v1/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client:      secretKey,
      environment: env,
      currency:    'PKR',
      amount:      amountPKR,
    }),
  });

  if (!initResponse.ok) {
    const err = await initResponse.text();
    throw new Error(`Safepay init failed (${initResponse.status}): ${err}`);
  }

  const initData = await initResponse.json();
  const tracker  = initData?.data?.token;

  if (!tracker) {
    throw new Error(`Safepay returned no tracker token. Response: ${JSON.stringify(initData)}`);
  }

  // ── Step 2: Build checkout URL ─────────────────────
  //
  // Redirect customer to /components on the checkout base.
  // Params: env, beacon (tracker token), source, order_id,
  //         success_url, cancel_url
  const params = new URLSearchParams({
    env,
    beacon:      tracker,
    source:      'custom',
    order_id:    orderNumber,
    redirect_url: `${frontendUrl}/customer/orders?payment=success&order=${orderId}`,
    cancel_url:   `${frontendUrl}/customer/cart?payment=cancelled`,
  });

  const checkoutUrl = `${checkoutBase}/checkout/pay?${params.toString()}`;

  return { tracker, checkoutUrl };
}

// ─── Safepay: Verify Webhook Signature ────────────────

/**
 * Verifies the HMAC-SHA256 signature Safepay sends on all webhooks.
 * Returns true if the signature is valid.
 *
 * Safepay sends:
 *   Header: X-SFPY-SIGNATURE: <hex_signature>
 *   Signature = HMAC-SHA256(rawBody, SAFEPAY_WEBHOOK_SECRET)
 *
 * Required env var:
 *   SAFEPAY_WEBHOOK_SECRET — from Safepay Dashboard → Developers → Webhooks
 */
export function verifySafepayWebhook(rawBody: Buffer, signature: string): boolean {
  const webhookSecret = process.env.SAFEPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Safepay] SAFEPAY_WEBHOOK_SECRET not set — cannot verify webhook signature');
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // timingSafeEqual prevents timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature,  'hex')
    );
  } catch {
    return false;
  }
}

// ─── Stub: for local development ──────────────────────

/**
 * Stub session — returns a fake tracker and a local redirect URL.
 * In dev, payment is auto-confirmed after 3 seconds via the stub webhook.
 */
export function createStubSession(
  orderId: string,
  orderNumber: string,
  amountPKR: number
): SafepaySession {
  const tracker     = `stub_tracker_${orderId.slice(-8)}`;
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  console.log(`\n💳 [Payment STUB] Order: ${orderNumber}  Amount: PKR ${amountPKR}`);
  console.log(`   Tracker: ${tracker}`);
  console.log(`   To confirm: POST /api/payments/stub-confirm { orderId: "${orderId}" }\n`);

  return {
    tracker,
    checkoutUrl: `${frontendUrl}/customer/orders?payment=success&order=${orderId}&stub=1`,
  };
}

// ─── Dispatcher ───────────────────────────────────────

export async function createPaymentSession(
  orderId: string,
  orderNumber: string,
  amountPKR: number
): Promise<SafepaySession> {
  const provider = process.env.PAYMENT_PROVIDER ?? 'stub';

  if (provider === 'safepay') {
    return createSafepaySession(orderId, orderNumber, amountPKR);
  }

  // Default: stub
  return createStubSession(orderId, orderNumber, amountPKR);
}
