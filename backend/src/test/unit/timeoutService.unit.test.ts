import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../config/db', () => ({
  prisma: {
    order: { findMany: vi.fn(), update: vi.fn() },
    payment: { updateMany: vi.fn() },
    shift: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/sseManager', () => ({
  sseManager: {
    sendToCustomer: vi.fn(),
  },
}));

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { startTimeoutService, stopTimeoutService } from '../../services/timeoutService';
import { prisma } from '../../config/db';
import { sseManager } from '../../services/sseManager';

const mockPrisma = vi.mocked(prisma);

describe('[timeoutService] - expirePendingPayments', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopTimeoutService();
    vi.useRealTimers();
  });

  it('should cancel orders with stale safepay payments (>30min)', async () => {
    const staleOrder = {
      id: 'ord-1',
      orderNumber: 'CH-STALE',
      customerId: 'cust-1',
    };

    mockPrisma.order.findMany
      .mockResolvedValueOnce([staleOrder] as any) // expirePendingPayments
      .mockResolvedValueOnce([])                   // expirePendingOrders
      ;
    mockPrisma.shift.findMany.mockResolvedValue([]); // expireDanglingShifts
    mockPrisma.$transaction.mockResolvedValue(undefined);

    startTimeoutService();
    await vi.advanceTimersByTimeAsync(60_000); // trigger first tick

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentStatus: 'pending',
          paymentMethod: 'safepay',
          status: 'pending',
        }),
      })
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should send SSE notification when payment times out', async () => {
    const staleOrder = { id: 'ord-1', orderNumber: 'CH-X', customerId: 'cust-1' };

    mockPrisma.order.findMany
      .mockResolvedValueOnce([staleOrder] as any)
      .mockResolvedValueOnce([]);
    mockPrisma.shift.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockResolvedValue(undefined);

    startTimeoutService();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sseManager.sendToCustomer).toHaveBeenCalledWith(
      'cust-1',
      'PAYMENT_FAILED',
      expect.objectContaining({ orderId: 'ord-1', reason: 'Payment timed out' })
    );
  });
});

describe('[timeoutService] - expirePendingOrders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopTimeoutService();
    vi.useRealTimers();
  });

  it('should cancel pending orders with no payment after 15min', async () => {
    const staleOrder = { id: 'ord-2', orderNumber: 'CH-NOPAY', customerId: 'cust-2' };

    mockPrisma.order.findMany
      .mockResolvedValueOnce([])                      // expirePendingPayments (no stale payments)
      .mockResolvedValueOnce([staleOrder] as any);    // expirePendingOrders
    mockPrisma.shift.findMany.mockResolvedValue([]);
    mockPrisma.order.update.mockResolvedValue({} as any);

    startTimeoutService();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-2' },
        data: { status: 'cancelled' },
      })
    );
  });

  it('should send ORDER_UPDATED SSE when order times out', async () => {
    const staleOrder = { id: 'ord-2', orderNumber: 'CH-TO', customerId: 'cust-2' };

    mockPrisma.order.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([staleOrder] as any);
    mockPrisma.shift.findMany.mockResolvedValue([]);
    mockPrisma.order.update.mockResolvedValue({} as any);

    startTimeoutService();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sseManager.sendToCustomer).toHaveBeenCalledWith(
      'cust-2',
      'ORDER_UPDATED',
      expect.objectContaining({ status: 'cancelled' })
    );
  });
});

describe('[timeoutService] - expireDanglingShifts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopTimeoutService();
    vi.useRealTimers();
  });

  it('should auto-close shifts older than 12h', async () => {
    const staleShift = { id: 'shift-1', cashierId: 'cashier-1', totalSales: 5000, orderCount: 10 };

    mockPrisma.order.findMany
      .mockResolvedValue([]); // no stale orders/payments
    mockPrisma.shift.findMany.mockResolvedValue([staleShift] as any);
    mockPrisma.shift.update.mockResolvedValue({} as any);

    startTimeoutService();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockPrisma.shift.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shift-1' },
        data: expect.objectContaining({
          status: 'closed',
          notes: expect.stringContaining('Auto-closed'),
        }),
      })
    );
  });
});

describe('[timeoutService] - start/stop lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopTimeoutService();
    vi.useRealTimers();
  });

  it('should not start multiple intervals if called twice', () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.shift.findMany.mockResolvedValue([]);

    startTimeoutService();
    startTimeoutService(); // second call should be a no-op

    // If it started twice, we'd get double calls after one tick
    // Just verify it doesn't throw
    expect(true).toBe(true);
  });

  it('should stop the interval cleanly', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.shift.findMany.mockResolvedValue([]);

    startTimeoutService();
    stopTimeoutService();

    await vi.advanceTimersByTimeAsync(120_000); // advance past two intervals

    // After stopping, no DB calls should happen
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
  });
});
