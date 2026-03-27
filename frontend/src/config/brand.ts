// ─────────────────────────────────────────────────────────────────
//  brand.ts  — CheezyHub brand config
// ─────────────────────────────────────────────────────────────────

export const brand = {
  name:         'CheezyHub',
  tagline:      'Fresh. Fast. Cheezylicious.',

  emoji:        '🧀',
  logoUrl:      '',
  logoEmoji:    '🧀',

  phone:        '+92 300 000 0000',
  supportPhone: '+92 300 000 0000',
  whatsapp:     '923000000000',
  email:        'hello@cheezyhub.pk',
  address:      'F-7 Markaz, Islamabad, Pakistan',
  openingHours: 'Daily 11:00 AM – 11:00 PM',

  currency:       'PKR',
  currencySymbol: 'Rs',

  showPoweredBy:  true,
  paymentMethods: ['cash', 'card', 'easypaisa', 'jazzcash'] as const,

  /**
   * Legal / policy links — accessed as brand.legal.privacy, brand.legal.terms, brand.legal.refund
   * (CustomerFooter uses these exact key names)
   */
  legal: {
    privacy: '/privacy',
    terms:   '/terms',
    refund:  '/refund-policy',
  },

  social: {
    instagram: 'https://instagram.com/cheezyhub',
    facebook:  'https://facebook.com/cheezyhub',
    tiktok:    'https://tiktok.com/@cheezyhub',
    twitter:   '',
    youtube:   '',
  },

  meta: {
    title:       'CheezyHub — Fresh. Fast. Cheezylicious.',
    description: 'Order cheesy, delicious food for delivery or pickup in Islamabad.',
    ogImage:     '/og-image.png',
  },

  googleMapsUrl: 'https://maps.google.com',
} as const;

export type Brand = typeof brand;
