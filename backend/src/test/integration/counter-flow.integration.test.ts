import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../createTestApp';
import { buildStaff, generateTestToken } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    staff: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    order: { create: vi.fn(), findMany: vi.fn() },
    menuItem: { findMany: vi.fn() },
    shift: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    ledgerEntry: { create: vi.fn(), findMany: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _sum: { cashAmount: 0 } }) },
    settings: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/sseManager', () => ({
  sseManager: {
    broadcastToKitchen: vi.fn(), broadcastToAdmin: vi.fn(),
    broadcastToCounter: vi.fn(), sendToCustomer: vi.fn(),
  },
}));

vi.mock('../../services/whatsapp', () => ({
  whatsappService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/inventoryService', () => ({
  validateAndPriceOrder: vi.fn().mockResolvedValue({
    lines: [{ menuItemId: 'item-1', menuItemName: 'Burger', quantity: 1, unitPrice: 500, totalPrice: 500, selectedModifiers: [] }],
    subtotal: 500,
  }),
}));

import { prisma } from '../../config/db';

const mockPrisma = vi.mocked(prisma);
const app = createTestApp();

describe('[Integration] Counter Flow', () => {
  const cashier = buildStaff({ id: 'cash-1', role: 'counter', username: 'cashier1' });
  const cashierToken = generateTestToken('cash-1', 'cashier');

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.staff.findFirst.mockResolvedValue(cashier as any);
    mockPrisma.staff.findUnique.mockResolvedValue(cashier as any);
    // Mock $transaction to execute callback with prisma-like tx
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: { create: vi.fn().mockResolvedValue({ id: 'ord-1', orderNumber: 'CH-POS-001', status: 'pending', total: 500, items: [] }) },
        ledgerEntry: { create: vi.fn().mockResolvedValue({ id: 'le-1' }) },
        shift: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
  });

  describe('Shift management', () => {
    it('should start a new shift', async () => {
      mockPrisma.shift.findFirst.mockResolvedValue(null); // No active shift
      mockPrisma.shift.create.mockResolvedValue({ id: 'shift-1', openingFloat: 5000, staffId: 'cash-1' } as any);

      const res = await request(app)
        .post('/api/counter/shift/start')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ openingFloat: 5000 });

      expect([200, 201]).toContain(res.status);
    });

    it('should end an active shift', async () => {
      mockPrisma.shift.findFirst.mockResolvedValue({ id: 'shift-1', openingFloat: 5000 } as any);
      mockPrisma.shift.update.mockResolvedValue({ id: 'shift-1', closingCash: 7500 } as any);

      const res = await request(app)
        .post('/api/counter/shift/end')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ closingCash: 7500, notes: 'All good' });

      expect([200, 204]).toContain(res.status);
    });
  });

  describe('POS orders', () => {
    it('should place a counter order', async () => {
      mockPrisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Burger', basePrice: 500, isAvailable: true, deletedAt: null, modifierGroups: [] },
      ] as any);
      mockPrisma.settings.findFirst.mockResolvedValue({ deliveryFee: 0, serviceCharge: 0 } as any);
      mockPrisma.order.create.mockResolvedValue({ id: 'ord-1', orderNumber: 'CH-POS-001', status: 'pending', total: 500 } as any);

      const res = await request(app)
        .post('/api/counter/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          items: [{ menuItemId: 'item-1', quantity: 1, selectedModifierIds: [] }],
          paymentMethod: 'cash',
        });

      expect([200, 201]).toContain(res.status);
    });
  });

  describe('Access control', () => {
    it('should reject customer token', async () => {
      const customerToken = generateTestToken('u1', 'customer');
      const res = await request(app)
        .get('/api/counter/orders')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
