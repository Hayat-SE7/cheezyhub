// ─────────────────────────────────────────────────────
//  WHATSAPP NOTIFICATION SERVICE  v6.1
//
//  Three providers — switch with WHATSAPP_PROVIDER env var:
//    stub   → console.log only (default for local dev)
//    twilio → Twilio WhatsApp API
//    meta   → Meta WhatsApp Cloud API (recommended for production)
//
//  Every send is logged in notification_logs.
//  Failed sends store errorMsg so admin can see what went wrong.
//  Admin can retry failed logs via:
//    POST /api/admin/notifications/:id/retry
// ─────────────────────────────────────────────────────

import { prisma } from '../config/db';

// ─── Event Types ──────────────────────────────────────

export type WhatsAppEventType =
  | 'ORDER_CONFIRMED'
  | 'OUT_FOR_DELIVERY'
  | 'ORDER_COMPLETED'
  | 'TICKET_REPLY';

// ─── Message Templates ────────────────────────────────
//
// ⚠️  META PRODUCTION NOTE:
//   Outbound messages (you message customer first) MUST use pre-approved
//   Message Templates submitted at business.facebook.com → WhatsApp Manager.
//   These free-form strings work:
//     • In the Twilio sandbox (testing)
//     • Within Meta's 24h customer service window (customer messaged you first)
//     • With Twilio production if you have an approved WhatsApp Business number
//   For fully outbound Meta notifications, submit each template for approval
//   (takes 24–72h). Keep the same wording and variable format.

function buildMessage(type: WhatsAppEventType, payload: Record<string, any>): string {
  switch (type) {
    case 'ORDER_CONFIRMED':
      return (
        `✅ Hi ${payload.customerName}! Your order *#${payload.orderNumber}* has been confirmed.\n\n` +
        `We're getting it ready fresh for you! 🧀\n\n` +
        `You'll get another message when it's on its way.`
      );

    case 'OUT_FOR_DELIVERY': {
      const trackLine = payload.trackingLink
        ? `\n📍 Track your driver: ${payload.trackingLink}`
        : '';
      return (
        `🛵 Your order *#${payload.orderNumber}* is on its way!\n\n` +
        `Your driver is heading to you now.${trackLine}\n\n` +
        `Payment is *Cash on Delivery*. Please have the exact amount ready.`
      );
    }

    case 'ORDER_COMPLETED':
      return (
        `🎉 Order *#${payload.orderNumber}* delivered!\n\n` +
        `Thank you for ordering from CheezyHub! Enjoy your meal 🧀\n\n` +
        `Had an issue? Open the app and raise a support ticket.`
      );

    case 'TICKET_REPLY': {
      const preview =
        typeof payload.adminReply === 'string' && payload.adminReply.length > 120
          ? payload.adminReply.substring(0, 120) + '...'
          : (payload.adminReply ?? '');
      return (
        `💬 CheezyHub Support replied to your ticket:\n\n"${preview}"\n\nLog in to view the full response.`
      );
    }

    default:
      return '';
  }
}

// ─── Provider: Stub ───────────────────────────────────
//  Used in local dev. Logs to console instead of sending.

async function sendViaStub(to: string, message: string): Promise<void> {
  console.log(`\n📱 [WhatsApp STUB] To: ${to}`);
  console.log(message.split('\n').map((l) => `   ${l}`).join('\n'));
  console.log();
}

// ─── Provider: Twilio ─────────────────────────────────
//
//  Required env vars:
//    TWILIO_SID              Account SID (starts with AC...)
//    TWILIO_TOKEN            Auth Token
//    TWILIO_WHATSAPP_FROM    Your sandbox/prod number e.g. "whatsapp:+14155238886"
//
//  Sandbox setup (testing):
//    1. Sign up at twilio.com
//    2. Go to Messaging → Try it out → Send a WhatsApp message
//    3. Scan QR with your phone to join sandbox
//    4. Use sandbox number as TWILIO_WHATSAPP_FROM
//
//  Production:
//    1. Apply for a WhatsApp Business number in Twilio Console
//    2. Get approved (can take a few days)
//    3. Update TWILIO_WHATSAPP_FROM to your approved number
//
//  Install: cd backend && npm install twilio

async function sendViaTwilio(to: string, message: string): Promise<void> {
  const sid   = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    throw new Error(
      'Twilio not fully configured. Need: TWILIO_SID, TWILIO_TOKEN, TWILIO_WHATSAPP_FROM'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio')(sid, token);

  await twilio.messages.create({
    from,                      // e.g. "whatsapp:+14155238886"
    to:   `whatsapp:${to}`,   // e.g. "whatsapp:+923001234567"
    body: message,
  });
}

// ─── Provider: Meta WhatsApp Cloud API ───────────────
//
//  Required env vars:
//    META_WHATSAPP_TOKEN     Permanent system user access token
//    META_PHONE_NUMBER_ID    From Meta Developer Console → WhatsApp → Phone numbers
//
//  Setup guide:
//    1. Go to developers.facebook.com → Create App → Business
//    2. Add "WhatsApp" product to the app
//    3. Go to WhatsApp → Getting Started → get a test phone number
//    4. Create a System User in Business Manager → generate permanent token
//       with whatsapp_business_messaging permission
//    5. Set META_WHATSAPP_TOKEN and META_PHONE_NUMBER_ID
//
//  For production outbound (you message customer first):
//    Submit message templates at business.facebook.com → WhatsApp Manager
//    Then swap buildMessage() output for a template call:
//    https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
//
//  No extra package needed — uses native fetch (Node 18+)

async function sendViaMeta(to: string, message: string): Promise<void> {
  const token   = process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    throw new Error(
      'Meta not fully configured. Need: META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID'
    );
  }

  // Meta expects number WITHOUT '+', in international format
  // e.g. "+923001234567" → "923001234567"
  const metaTo = to.replace(/^\+/, '');

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: metaTo,
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Meta API ${response.status}: ${errBody}`);
  }
}

// ─── Dispatcher ───────────────────────────────────────

async function _sendToProvider(to: string, message: string): Promise<void> {
  const provider = process.env.WHATSAPP_PROVIDER ?? 'stub';

  switch (provider) {
    case 'twilio': return sendViaTwilio(to, message);
    case 'meta':   return sendViaMeta(to, message);
    default:       return sendViaStub(to, message);
  }
}

// ─── WhatsApp Service Class ───────────────────────────

class WhatsAppService {
  /**
   * Send a WhatsApp notification.
   * Always creates a notification_log entry.
   * On failure: logs errorMsg so admin can see it and retry.
   */
  async send(
    type: WhatsAppEventType,
    to: string,
    payload: Record<string, any>
  ): Promise<void> {
    if (!to) return;

    const phone   = to.startsWith('+') ? to : `+${to}`;
    const message = buildMessage(type, payload);
    if (!message) return;

    const log = await prisma.notificationLog.create({
      data: { to: phone, type, payload, status: 'pending', retryCount: 0 },
    });

    try {
      await _sendToProvider(phone, message);

      await prisma.notificationLog.update({
        where: { id: log.id },
        data:  { status: 'sent', errorMsg: null },
      });
    } catch (err: any) {
      console.error(`[WhatsApp] Failed to send ${type} to ${phone}:`, err?.message);

      await prisma.notificationLog.update({
        where: { id: log.id },
        data:  { status: 'failed', errorMsg: err?.message ?? 'Unknown error' },
      }).catch(() => {});
    }
  }

  /**
   * Retry a specific failed notification log.
   * Called from: POST /api/admin/notifications/:id/retry
   */
  async retry(logId: string): Promise<void> {
    const log = await prisma.notificationLog.findUnique({ where: { id: logId } });

    if (!log)              throw new Error(`Log ${logId} not found`);
    if (log.status === 'sent') throw new Error('Already sent successfully');

    const message = buildMessage(
      log.type as WhatsAppEventType,
      log.payload as Record<string, any>
    );
    if (!message) throw new Error(`Cannot build message for type "${log.type}"`);

    await prisma.notificationLog.update({
      where: { id: logId },
      data:  { status: 'pending', retryCount: { increment: 1 } },
    });

    try {
      await _sendToProvider(log.to, message);
      await prisma.notificationLog.update({
        where: { id: logId },
        data:  { status: 'sent', errorMsg: null },
      });
    } catch (err: any) {
      await prisma.notificationLog.update({
        where: { id: logId },
        data:  { status: 'failed', errorMsg: err?.message ?? 'Retry failed' },
      }).catch(() => {});
      throw err; // re-throw so the route can return a 500
    }
  }

  // Alias for existing code
  async sendWhatsAppMessage(
    type: WhatsAppEventType,
    phone: string,
    payload: Record<string, any>
  ): Promise<void> {
    await this.send(type, phone, payload);
  }
}

export const whatsappService = new WhatsAppService();

// Backward-compatible export used in tickets.ts and lifecycle
export async function notify(
  to: string,
  type: string,
  payload: Record<string, any>
): Promise<void> {
  const typeMap: Record<string, WhatsAppEventType> = {
    order_confirmed:  'ORDER_CONFIRMED',
    out_for_delivery: 'OUT_FOR_DELIVERY',
    order_completed:  'ORDER_COMPLETED',
    ticket_reply:     'TICKET_REPLY',
  };
  await whatsappService.send((typeMap[type] ?? type) as WhatsAppEventType, to, payload);
}
