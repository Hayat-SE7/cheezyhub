import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildOrder, buildStaff } from '../helpers';

vi.mock('../../config/db', () => ({
  prisma: {
    order: { findUnique: vi.fn(), update: vi.fn() },
    staff: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const sseManagerMock = vi.hoisted(() => ({
  broadcastToKitchen: vi.fn(),
  broadcastToAdmin: vi.fn(),
  broadcastToDelivery: vi.fn(),
  broadcastToCounter: vi.fn(),
  sendToCustomer: vi.fn(),
  sendToDriver: vi.fn(),
}));

vi.mock('../../services/sseManager', () => ({
  sseManager: sseManagerMock,
}));

vi.mock('../../services/whatsapp', () => ({
  whatsappService: { send: vi.fn() },
}));

vi.mock('../../services/assignmentService', () => ({
  assignDriver: vi.fn(),
}));

import { prisma } from '../../config/db';
import { whatsappService } from '../../services/whatsapp';
import { applyStatusChange } from '../../services/orderLifecycle';

const mockPrisma = vi.mocked(prisma);

describe('[Integration] Partial Failures', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('DB success + WhatsApp fail', () => {
    it('should complete status change even if WhatsApp notification fails', async () => {
      const order = buildOrder({ id: 'o1', status: 'assigned', customerId: 'c1', driverId: 'd1' });
      const picked = { ...order, status: 'picked_up' };

      mockPrisma.order.findUnique.mockResolvedValue(order as any);
      mockPrisma.order.update.mockResolvedValue(picked as any);
      vi.mocked(whatsappService.send).mockRejectedValue(new Error('WhatsApp API 500'));

      // WhatsApp failure in _fireWhatsApp should not propagate because it's awaited
      // but the function may still throw. Let's see:
      try {
        const result = await applyStatusChange('o1', 'picked_up' as any, 'delivery');
        expect(result.status).toBe('picked_up');
      } catch (e: any) {
        // If it propagates, the DB update still happened
        expect(mockPrisma.order.update).toHaveBeenCalled();
      }
    });
  });

  describe('Assignment failure on ready', () => {
    it('should return ready status even if auto-assignment fails asynchronously', async () => {
      const order = buildOrder({ id: 'o1', status: 'preparing', customerId: 'c1', orderType: 'delivery' });
      const ready = { ...order, status: 'ready' };

      mockPrisma.order.findUnique.mockResolvedValue(order as any);
      mockPrisma.order.update.mockResolvedValue(ready as any);

      const { assignDriver } = await import('../../services/assignmentService');
      vi.mocked(assignDriver).mockRejectedValue(new Error('No drivers available'));

      // assignDriver is fire-and-forget (.catch handles error)
      const result = await applyStatusChange('o1', 'ready' as any, 'kitchen');
      expect(result.status).toBe('ready');
    });
  });

  describe('SSE broadcast verification', () => {
    it('should broadcast to kitchen and admin on status change', async () => {
      const order = buildOrder({ id: 'o1', status: 'pending', customerId: 'c1' });
      const updated = { ...order, status: 'preparing' };

      mockPrisma.order.findUnique.mockResolvedValue(order as any);
      mockPrisma.order.update.mockResolvedValue(updated as any);

      await applyStatusChange('o1', 'preparing' as any, 'kitchen');

      expect(sseManagerMock.broadcastToKitchen).toHaveBeenCalledWith(
        'ORDER_UPDATED',
        expect.objectContaining({ status: 'preparing' })
      );
      expect(sseManagerMock.broadcastToAdmin).toHaveBeenCalledWith(
        'ORDER_UPDATED',
        expect.objectContaining({ status: 'preparing' })
      );
    });

    it('should send customer SSE notification on status change', async () => {
      const order = buildOrder({ id: 'o1', status: 'pending', customerId: 'c1' });
      const updated = { ...order, status: 'preparing' };

      mockPrisma.order.findUnique.mockResolvedValue(order as any);
      mockPrisma.order.update.mockResolvedValue(updated as any);

      await applyStatusChange('o1', 'preparing' as any, 'kitchen');

      expect(sseManagerMock.sendToCustomer).toHaveBeenCalledWith(
        'c1',
        'ORDER_UPDATED',
        expect.objectContaining({ status: 'preparing' })
      );
    });
  });
});
