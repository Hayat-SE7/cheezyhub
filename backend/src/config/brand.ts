// ─────────────────────────────────────────────────────────────
//  CheezyHub — Brand Config  (backend)
//  src/config/brand.ts
//
//  Mirror of frontend brand config — used for:
//    - WhatsApp notification templates
//    - Receipt / invoice headers
//    - Email subjects
//    - SMS copy
// ─────────────────────────────────────────────────────────────

export const brand = {
  name:        'CheezyHub',
  tagline:     'Fresh. Fast. Cheesy.',
  logoEmoji:   '🧀',

  supportPhone: '+923001234567',
  whatsapp:     '+923001234567',
  address:      'Gulberg III, Lahore',
  openingHours: 'Daily: 11:00 AM – 11:00 PM',
  email:        'hello@cheezyhub.pk',

  currency:      'Rs.',
  taxLabel:      'GST',
  receiptHeader: 'Thank you for ordering from CheezyHub!',
  receiptFooter: 'Powered by CheezyHub SaaS',

  // WhatsApp notification templates
  // Variables: {orderId}, {status}, {driverName}, {eta}
  notifications: {
    orderConfirmed: (orderId: string) =>
      `✅ *CheezyHub* — Your order *#${orderId.slice(-6).toUpperCase()}* has been confirmed! We're preparing it now. 🧀`,

    orderReady: (orderId: string) =>
      `🔔 *CheezyHub* — Order *#${orderId.slice(-6).toUpperCase()}* is ready and a driver is on the way!`,

    orderPickedUp: (orderId: string, driverName: string) =>
      `🛵 *CheezyHub* — *${driverName}* has picked up your order *#${orderId.slice(-6).toUpperCase()}* and is heading your way!`,

    orderDelivered: (orderId: string) =>
      `🎉 *CheezyHub* — Order *#${orderId.slice(-6).toUpperCase()}* delivered! Enjoy your meal. Rate us: cheezyhub.pk/rate`,

    orderCancelled: (orderId: string) =>
      `❌ *CheezyHub* — Order *#${orderId.slice(-6).toUpperCase()}* was cancelled. Contact us at ${'+923001234567'} for help.`,
  },
} as const;

export type Brand = typeof brand;
