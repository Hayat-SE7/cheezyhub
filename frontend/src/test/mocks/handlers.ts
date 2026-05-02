import { http, HttpResponse } from 'msw';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Menu ──────────────────────────────────────────────
const mockMenu = [
  {
    id: 'cat-1',
    name: 'Burgers',
    items: [
      {
        id: 'item-1',
        name: 'Classic Burger',
        description: 'Beef patty with cheese',
        basePrice: 500,
        imageUrl: null,
        isAvailable: true,
        modifierGroups: [
          {
            id: 'mg-1',
            name: 'Extras',
            required: false,
            modifiers: [
              { id: 'mod-1', name: 'Extra Cheese', priceAdjustment: 50, isAvailable: true },
              { id: 'mod-2', name: 'Bacon', priceAdjustment: 100, isAvailable: true },
              { id: 'mod-3', name: 'Jalapeno', priceAdjustment: 30, isAvailable: false },
            ],
          },
        ],
      },
      {
        id: 'item-2',
        name: 'Veggie Burger',
        basePrice: 400,
        isAvailable: false,
        modifierGroups: [],
      },
    ],
  },
  {
    id: 'cat-2',
    name: 'Sides',
    items: [
      { id: 'item-3', name: 'Fries', basePrice: 200, isAvailable: true, modifierGroups: [] },
    ],
  },
];

// ── Orders ────────────────────────────────────────────
const mockOrders = [
  {
    id: 'ord-1',
    orderNumber: 'CH-001',
    status: 'preparing',
    total: 700,
    subtotal: 550,
    deliveryFee: 150,
    serviceCharge: 0,
    deliveryAddress: '123 Main St',
    createdAt: new Date().toISOString(),
    items: [
      { id: 'oi-1', menuItemId: 'item-1', menuItemName: 'Classic Burger', quantity: 1, unitPrice: 550, totalPrice: 550, selectedModifiers: [{ name: 'Extra Cheese' }] },
    ],
  },
  {
    id: 'ord-2',
    orderNumber: 'CH-002',
    status: 'completed',
    total: 400,
    subtotal: 400,
    deliveryFee: 0,
    serviceCharge: 0,
    deliveryAddress: '456 Oak Ave',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    items: [
      { id: 'oi-2', menuItemId: 'item-3', menuItemName: 'Fries', quantity: 2, unitPrice: 200, totalPrice: 400, selectedModifiers: [] },
    ],
  },
];

export const handlers = [
  // Menu
  http.get(`${API}/menu`, () => HttpResponse.json({ success: true, data: mockMenu })),
  http.get(`${API}/menu/settings/public`, () =>
    HttpResponse.json({ success: true, data: { deliveryFee: 150, freeDeliveryThreshold: 1500, serviceCharge: 0 } }),
  ),

  // Auth
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as any;
    if (body.pin === '0000') return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    return HttpResponse.json({
      success: true,
      data: { token: 'mock-token', refreshToken: 'mock-refresh', user: { id: 'u1', name: 'Test User', role: 'customer' } },
    });
  }),
  http.post(`${API}/auth/send-otp`, () => HttpResponse.json({ success: true, data: { message: 'OTP sent' } })),
  http.post(`${API}/auth/verify-otp`, () =>
    HttpResponse.json({ success: true, data: { verificationToken: 'vt-123' } }),
  ),
  http.post(`${API}/auth/complete-registration`, () =>
    HttpResponse.json({
      success: true,
      data: { token: 'mock-token', refreshToken: 'mock-refresh', user: { id: 'u2', name: 'New User', role: 'customer' } },
    }),
  ),
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ success: true, data: { token: 'new-token', refreshToken: 'new-refresh' } }),
  ),

  // Orders
  http.get(`${API}/orders`, () => HttpResponse.json({ success: true, data: mockOrders })),
  http.post(`${API}/orders`, () =>
    HttpResponse.json({ success: true, data: { id: 'ord-new', orderNumber: 'CH-100' } }, { status: 201 }),
  ),

  // Payments
  http.post(`${API}/payments/create`, () =>
    HttpResponse.json({ success: true, data: { paymentId: 'pay-1', checkoutUrl: 'https://safepay.test/checkout' } }),
  ),

  // Addresses
  http.get(`${API}/addresses`, () =>
    HttpResponse.json({ success: true, data: [{ id: 'addr-1', addressText: '123 Main St', isDefault: true }] }),
  ),
  http.post(`${API}/addresses`, () => HttpResponse.json({ success: true, data: { id: 'addr-2' } })),
  http.post(`${API}/addresses/gps`, () => HttpResponse.json({ success: true, data: { id: 'addr-3' } })),

  // SSE ticket
  http.post(`${API}/sse/ticket`, () => HttpResponse.json({ success: true, data: { ticket: 'sse-ticket-123' } })),
];

export { mockMenu, mockOrders };
