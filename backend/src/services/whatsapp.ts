// ─────────────────────────────────────────────────────
//  WHATSAPP NOTIFICATION SERVICE
//  Typed event system. Plug in any provider.
// ─────────────────────────────────────────────────────

import { prisma } from '../config/db';

// ─── Event Types ──────────────────────────────────────

export type WhatsAppEventType =
  | 'ORDER_CONFIRMED'
  | 'OUT_FOR_DELIVERY'
  | 'ORDER_COMPLETED'
  | 'TICKET_REPLY';

// ─── Message Templates ────────────────────────────────

function buildMessage(type: WhatsAppEventType, payload: Record<string, any>): string {
  switch (type) {
    case 'ORDER_CONFIRMED':
      return (
        `✅ Hi ${payload.customerName}! Your order *#${payload.orderNumber}* has been confirmed.\n\n` +
        `We're getting it ready fresh for you! 🧀\n\n` +
        `You'll receive another message when it's on its way.`
      );

    case 'OUT_FOR_DELIVERY': {
      const trackLine = payload.trackingLink
        ? `\n📍 Track: ${payload.trackingLink}`
        : '';
      return (
        `🛵 Your order *#${payload.orderNumber}* is on its way!\n\n` +
        `Your driver is heading to you now.${trackLine}\n\n` +
        `Payment is *Cash on Delivery*. Please have the amount ready.`
      );
    }

    case 'ORDER_COMPLETED':
      return (
        `🎉 Order *#${payload.orderNumber}* delivered!\n\n` +
        `Thank you for ordering from CheezyHub! Hope you enjoy your meal 🧀`
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

// ─── Low-level sender (stub — swap for real provider) ─

async function _sendToProvider(to: string, message: string): Promise<boolean> {
  // ════════════════════════════════════════════════
  //  REPLACE THIS BLOCK with your WhatsApp provider
  //
  //  Twilio:
  //    const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
  //    await client.messages.create({
  //      from: 'whatsapp:+14155238886',
  //      to: `whatsapp:${to}`,
  //      body: message,
  //    });
  //
  //  WhatsApp Cloud API (Meta):
  //    await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
  //      method: 'POST',
  //      headers: { Authorization: `Bearer ${TOKEN}` },
  //      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
  //    });
  // ════════════════════════════════════════════════

  console.log(`\n📱 [WhatsApp STUB] To: ${to}`);
  console.log(message.split('\n').map((l) => `   ${l}`).join('\n'), '\n');
  return true;
}

// ─── WhatsApp Service Class ───────────────────────────

class WhatsAppService {
  /**
   * Primary method. Type-safe. Logs everything to DB.
   *
   * @example
   * await whatsappService.send('ORDER_CONFIRMED', '+923001234', {
   *   orderNumber: 'CH-ABC123',
   *   customerName: 'Ahmed',
   * });
   */
  async send(
    type: WhatsAppEventType,
    to: string,
    payload: Record<string, any>
  ): Promise<void> {
    if (!to) return;

    const phone = to.startsWith('+') ? to : `+${to}`;
    const message = buildMessage(type, payload);
    if (!message) return;

    const log = await prisma.notificationLog.create({
      data: { to: phone, type, payload, status: 'pending' },
    });

    try {
      const ok = await _sendToProvider(phone, message);
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: ok ? 'sent' : 'failed' },
      });
    } catch (err) {
      console.error('[WhatsApp] Send error:', err);
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'failed' },
      }).catch(() => {});
    }
  }

  /**
   * Convenience alias matching the doc's signature:
   * sendWhatsAppMessage(type, orderId, phone)
   */
  async sendWhatsAppMessage(
    type: WhatsAppEventType,
    phone: string,
    payload: Record<string, any>
  ): Promise<void> {
    await this.send(type, phone, payload);
  }
}

export const whatsappService = new WhatsAppService();

// Backward-compatible export for existing route code
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
  const mapped = (typeMap[type] ?? type) as WhatsAppEventType;
  await whatsappService.send(mapped, to, payload);
}
