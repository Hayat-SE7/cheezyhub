import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    staff: { update: vi.fn(), findUnique: vi.fn() },
    order: { findUnique: vi.fn() },
  },
}));
vi.mock('../../services/sseManager', () => ({
  sseManager: {
    broadcastToAdmin: vi.fn(),
    sendToDriver: vi.fn(),
  },
}));
vi.mock('../../services/orderLifecycle', () => ({
  applyStatusChange: vi.fn(),
}));
vi.mock('../../services/radiusService', () => ({
  haversineKm: vi.fn().mockReturnValue(5),
}));

import { prisma } from '../../config/db';
import { assignDriver } from '../../services/assignmentService';
import { applyStatusChange } from '../../services/orderLifecycle';

const mockPrisma = vi.mocked(prisma);
const mockApplyStatus = vi.mocked(applyStatusChange);

describe('[Concurrency] - Driver Assignment Race', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should use transaction to atomically pick and reserve driver', async () => {
    const driver = {
      id: 'drv-1', role: 'delivery', isActive: true, driverStatus: 'AVAILABLE',
      verificationStatus: 'VERIFIED', activeOrderCount: 0, liveLat: null, liveLng: null,
    };

    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: null, deliveryLng: null }) },
      staff: {
        findMany: vi.fn().mockResolvedValue([driver]),
        update: vi.fn().mockResolvedValue({ ...driver, driverStatus: 'ON_DELIVERY', activeOrderCount: 1 }),
      },
    };

    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
    mockApplyStatus.mockResolvedValue({} as any);
    mockPrisma.order.findUnique.mockResolvedValue({ orderNumber: 'CH-1', items: [], customer: { name: 'Test' } } as any);

    await assignDriver('ord-1');

    // Verify driver was updated inside transaction (atomically)
    expect(mockTx.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'drv-1' },
        data: expect.objectContaining({
          driverStatus: 'ON_DELIVERY',
          activeOrderCount: { increment: 1 },
        }),
      })
    );
  });

  it('should handle case where transaction finds no available driver', async () => {
    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: null, deliveryLng: null }) },
      staff: { findMany: vi.fn().mockResolvedValue([]) },
    };

    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

    await assignDriver('ord-1');

    // Should NOT attempt to apply status change
    expect(mockApplyStatus).not.toHaveBeenCalled();
  });

  it('should handle concurrent assignment attempts — second sees no available driver', async () => {
    const driver = {
      id: 'drv-1', role: 'delivery', isActive: true, driverStatus: 'AVAILABLE',
      verificationStatus: 'VERIFIED', activeOrderCount: 0, liveLat: null, liveLng: null,
    };

    // First call: driver available
    const mockTx1 = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: null, deliveryLng: null }) },
      staff: {
        findMany: vi.fn().mockResolvedValue([driver]),
        update: vi.fn().mockResolvedValue(driver),
      },
    };

    // Second call: no drivers (first call took the only one)
    const mockTx2 = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: null, deliveryLng: null }) },
      staff: { findMany: vi.fn().mockResolvedValue([]) },
    };

    let callCount = 0;
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      callCount++;
      return fn(callCount === 1 ? mockTx1 : mockTx2);
    });
    mockApplyStatus.mockResolvedValue({} as any);
    mockPrisma.order.findUnique.mockResolvedValue({ orderNumber: 'CH-1', items: [], customer: { name: 'Test' } } as any);

    // Run both assignments concurrently
    await Promise.all([
      assignDriver('ord-1'),
      assignDriver('ord-2'),
    ]);

    // First should succeed, second should broadcast no driver available
    expect(mockApplyStatus).toHaveBeenCalledTimes(1);
  });
});
