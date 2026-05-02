import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { generateTestToken } from '../helpers';

// Mock all DB + service deps
vi.mock('../../config/db', () => ({
  prisma: {
    staff: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0), aggregate: vi.fn().mockResolvedValue({ _sum: { total: 0 } }), create: vi.fn() },
    orderItem: { groupBy: vi.fn().mockResolvedValue([]) },
    category: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
    menuItem: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    modifier: { update: vi.fn() },
    modifierGroup: { deleteMany: vi.fn() },
    deal: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    systemSettings: { findFirst: vi.fn().mockResolvedValue({ ordersAccepting: true, deliveryFee: 0, freeDeliveryThreshold: 0, serviceCharge: 0 }), create: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    shift: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    ledgerEntry: { upsert: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
    offlineSyncLog: { findUnique: vi.fn(), create: vi.fn() },
    ticket: { count: vi.fn().mockResolvedValue(0) },
    notificationLog: { findMany: vi.fn().mockResolvedValue([]) },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    driverSettlement: { findMany: vi.fn().mockResolvedValue([]) },
    holidayRequest: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    processedWebhook: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../services/sseManager', () => ({ sseManager: { broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(), broadcastAll: vi.fn(), sendToCustomer: vi.fn(), sendToDriver: vi.fn(), addClient: vi.fn(), storeEvent: vi.fn(), replayEvents: vi.fn(), getClientCount: vi.fn().mockReturnValue(0), closeAll: vi.fn(), startSweep: vi.fn(), broadcastToCounter: vi.fn(), broadcastToDelivery: vi.fn(), sendToClient: vi.fn() } }));
vi.mock('../../services/orderLifecycle', () => ({ applyStatusChange: vi.fn() }));
vi.mock('../../services/inventoryService', () => ({ validateAndPriceOrder: vi.fn(), setItemAvailability: vi.fn(), setModifierAvailability: vi.fn() }));
vi.mock('../../services/dealsService', () => ({ validateDeals: vi.fn().mockResolvedValue({ totalDiscount: 0, deals: [] }) }));
vi.mock('../../services/radiusService', () => ({ checkDeliveryRadius: vi.fn(), isRadiusConfigured: vi.fn().mockReturnValue(false) }));
vi.mock('../../services/paymentService', () => ({ createPaymentSession: vi.fn(), verifySafepayWebhook: vi.fn() }));
vi.mock('../../services/whatsapp', () => ({ whatsappService: { send: vi.fn() } }));
vi.mock('../../services/tokenService', () => ({ issueTokenPair: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }), rotateRefreshToken: vi.fn(), revokeRefreshToken: vi.fn() }));
vi.mock('../../services/uploadService', () => ({ createUploader: vi.fn().mockReturnValue({ single: vi.fn().mockReturnValue((_r: any, _s: any, n: any) => n()) }), getFileUrl: vi.fn() }));
vi.mock('../../config/firebaseAdmin', () => ({ default: { auth: () => ({ verifyIdToken: vi.fn() }) } }));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../utils/csv', () => ({ toCsv: vi.fn().mockReturnValue(''), csvHeaders: vi.fn().mockReturnValue({}) }));
vi.mock('../../middleware/notFound', () => ({ notFound: vi.fn((_req: any, res: any) => res.status(404).json({ error: 'Not found' })) }));

import { createTestApp } from '../createTestApp';

const app = createTestApp();

// Role-specific tokens
const tokens = {
  customer: generateTestToken('cust-1', 'customer'),
  admin: generateTestToken('admin-1', 'admin'),
  kitchen: generateTestToken('kit-1', 'kitchen'),
  delivery: generateTestToken('drv-1', 'delivery'),
  cashier: generateTestToken('cash-1', 'cashier'),
};

// Full authorization matrix
const matrix: {
  route: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  allowed: string[];
  body?: Record<string, any>;
}[] = [
  // Admin routes — admin only
  { route: '/api/admin/staff', method: 'GET', allowed: ['admin'] },
  { route: '/api/admin/settings', method: 'GET', allowed: ['admin'] },
  { route: '/api/admin/stats', method: 'GET', allowed: ['admin'] },
  { route: '/api/admin/orders', method: 'GET', allowed: ['admin'] },

  // Kitchen routes — kitchen + admin
  { route: '/api/kitchen/orders', method: 'GET', allowed: ['admin', 'kitchen'] },

  // Delivery routes — delivery + admin
  { route: '/api/delivery/orders', method: 'GET', allowed: ['admin', 'delivery'] },
  { route: '/api/delivery/profile', method: 'GET', allowed: ['admin', 'delivery'] },

  // Counter routes — cashier + admin
  { route: '/api/counter/menu', method: 'GET', allowed: ['admin', 'cashier'] },

  // Customer order routes
  { route: '/api/orders', method: 'GET', allowed: ['customer'] },
];

describe('[Security] - Full Authorization Matrix', () => {
  const allRoles = ['customer', 'admin', 'kitchen', 'delivery', 'cashier'];

  for (const entry of matrix) {
    for (const role of allRoles) {
      const shouldAllow = entry.allowed.includes(role);
      const verb = shouldAllow ? 'allow' : 'deny';

      it(`should ${verb} '${role}' on ${entry.method} ${entry.route}`, async () => {
        const token = tokens[role as keyof typeof tokens];
        let req;

        switch (entry.method) {
          case 'GET': req = request(app).get(entry.route); break;
          case 'POST': req = request(app).post(entry.route).send(entry.body ?? {}); break;
          case 'PATCH': req = request(app).patch(entry.route).send(entry.body ?? {}); break;
          case 'DELETE': req = request(app).delete(entry.route); break;
        }

        const res = await req.set('Authorization', `Bearer ${token}`);

        if (shouldAllow) {
          expect(res.status).not.toBe(403);
          expect(res.status).not.toBe(401);
        } else {
          expect(res.status).toBe(403);
        }
      });
    }
  }

  it('should return 401 for all protected routes without token', async () => {
    const protectedRoutes = [
      '/api/admin/staff',
      '/api/kitchen/orders',
      '/api/delivery/orders',
      '/api/counter/menu',
      '/api/orders',
    ];

    for (const route of protectedRoutes) {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    }
  });
});
