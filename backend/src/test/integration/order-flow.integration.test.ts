import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildOrder, buildUser, buildStaff, buildMenuItem } from '../helpers';

// Mock DB
vi.mock('../../config/db', () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    menuItem: { findMany: vi.fn() },
    staff: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/sseManager', () => ({
  sseManager: {
    broadcastToKitchen: vi.fn(),
    broadcastToAdmin: vi.fn(),
    broadcastToDelivery: vi.fn(),
    broadcastToCounter: vi.fn(),
    sendToCustomer: vi.fn(),
    sendToDriver: vi.fn(),
  },
}));

vi.mock('../../services/whatsapp', () => ({
  whatsappService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/assignmentService', () => ({
  assignDriver: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../config/db';
import { applyStatusChange, validateTransition, getAllowedTransitions } from '../../services/orderLifecycle';
import { sseManager } from '../../services/sseManager';
import { assignDriver } from '../../services/assignmentService';

const mockPrisma = vi.mocked(prisma);

describe('[Integration] Order Flow — Full Lifecycle', () => {
  const customer = buildUser({ id: 'cust-1' });
  const driver = buildStaff({ id: 'driver-1', role: 'delivery' });

  beforeEach(() => vi.clearAllMocks());

  describe('pending → preparing → ready → assigned → picked_up → delivered → completed', () => {
    it('should allow kitchen to move pending → preparing', async () => {
      const order = buildOrder({ id: 'o1', status: 'pending', customerId: customer.id });
      const updated = { ...order, status: 'preparing' };

      mockPrisma.order.findUnique.mockResolvedValue(order as any);
      mockPrisma.order.update.mockResolvedValue(updated as any);

      const result = await applyStatusChange('o1', 'preparing' as any, 'kitchen');

      expect(result.status).toBe('preparing');
      expect(sseManager.broadcastToKitchen).toHaveBeenCalledWith('ORDER_UPDATED', expect.objectContaining({ status: 'preparing' }));
      expect(sseManager.sendToCustomer).toHaveBeenCalled();
    });

    it('should allow kitchen to move preparing → ready', async () => {
      const order = buildOrder({ id: 'o1', status: 'preparing', customerId: customer.id, orderType: 'delivery' });
      const updated = { ...order, status: 'ready' };

      mockPrisma.order.findUnique.mockResolvedValue(order as any);
      mockPrisma.order.update.mockResolvedValue(updated as any);

      await applyStatusChange('o1', 'ready' as any, 'kitchen');

      expect(assignDriver).toHaveBeenCalledWith('o1');
    });

    it('should allow delivery to move assigned → picked_up', async () => {
      const order = buildOrder({ id: 'o1', status: 'assigned', customerId: customer.id, driverId: driver.id });
      const updated = { ...order, status: 'picked_up' };

      mockPrisma.order.findUnique.mockResolvedValue(order as any);
      mockPrisma.order.update.mockResolvedValue(updated as any);

      const result = await applyStatusChange('o1', 'picked_up' as any, 'delivery');
      expect(result.status).toBe('picked_up');
    });

    it('should auto-complete after delivered', async () => {
      const order = buildOrder({ id: 'o1', status: 'picked_up', customerId: customer.id, driverId: driver.id, paymentMethod: 'cash', total: 1000 });
      const delivered = { ...order, status: 'delivered' };
      const completed = { ...order, status: 'completed' };

      mockPrisma.order.findUnique
        .mockResolvedValueOnce(order as any)      // first call for picked_up → delivered
        .mockResolvedValueOnce(delivered as any);  // second call for delivered → completed (auto)
      mockPrisma.order.update
        .mockResolvedValueOnce(delivered as any)
        .mockResolvedValueOnce(completed as any);
      mockPrisma.staff.update.mockResolvedValue(driver as any);

      const result = await applyStatusChange('o1', 'delivered' as any, 'delivery');
      expect(result.status).toBe('completed');
      expect(mockPrisma.staff.update).toHaveBeenCalled();
    });
  });

  describe('Invalid transitions', () => {
    it('should reject pending → completed', () => {
      expect(() => validateTransition('pending' as any, 'completed' as any, 'kitchen')).toThrow('Invalid transition');
    });

    it('should reject customer role from any transition', () => {
      expect(() => validateTransition('pending' as any, 'preparing' as any, 'customer')).toThrow(/Role/);
    });

    it('should reject backwards transitions', () => {
      expect(() => validateTransition('preparing' as any, 'pending' as any, 'kitchen')).toThrow('Invalid transition');
    });
  });

  describe('Cancellation', () => {
    it('should allow kitchen to cancel pending order', async () => {
      const order = buildOrder({ id: 'o1', status: 'pending', customerId: customer.id });
      const cancelled = { ...order, status: 'cancelled' };

      mockPrisma.order.findUnique.mockResolvedValue(order as any);
      mockPrisma.order.update.mockResolvedValue(cancelled as any);

      const result = await applyStatusChange('o1', 'cancelled' as any, 'kitchen');
      expect(result.status).toBe('cancelled');
    });

    it('should reject cancellation after assigned', () => {
      expect(() => validateTransition('assigned' as any, 'cancelled' as any, 'admin')).toThrow('Invalid transition');
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return preparing and cancelled for kitchen on pending', () => {
      const allowed = getAllowedTransitions('pending' as any, 'kitchen');
      expect(allowed).toContain('preparing');
      expect(allowed).toContain('cancelled');
    });

    it('should return nothing for customer role', () => {
      const allowed = getAllowedTransitions('pending' as any, 'customer');
      expect(allowed).toHaveLength(0);
    });
  });

  describe('Counter order auto-complete', () => {
    it('should auto-complete counter orders when ready (no driver needed)', async () => {
      const order = buildOrder({ id: 'o1', status: 'preparing', customerId: customer.id, orderType: 'counter' });
      const ready = { ...order, status: 'ready' };
      const completed = { ...order, status: 'completed' };

      mockPrisma.order.findUnique
        .mockResolvedValueOnce(order as any)
        .mockResolvedValueOnce(ready as any);
      mockPrisma.order.update
        .mockResolvedValueOnce(ready as any)
        .mockResolvedValueOnce(completed as any);

      const result = await applyStatusChange('o1', 'ready' as any, 'kitchen');
      expect(result.status).toBe('completed');
      expect(assignDriver).not.toHaveBeenCalled();
    });
  });
});
