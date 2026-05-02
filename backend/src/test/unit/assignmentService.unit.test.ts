import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../config/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    staff: { update: vi.fn(), findUnique: vi.fn() },
    order: { findUnique: vi.fn(), findFirst: vi.fn() },
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
  haversineKm: vi.fn(),
}));

import { assignDriver, manuallyAssignDriver } from '../../services/assignmentService';
import { prisma } from '../../config/db';
import { sseManager } from '../../services/sseManager';
import { applyStatusChange } from '../../services/orderLifecycle';
import { haversineKm } from '../../services/radiusService';
import { buildStaff, buildOrder } from '../helpers';

const mockPrisma = vi.mocked(prisma);
const mockHaversine = vi.mocked(haversineKm);
const mockApplyStatus = vi.mocked(applyStatusChange);

describe('[assignmentService] - assignDriver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should assign the nearest driver by haversine distance', async () => {
    const driverClose = buildStaff({ id: 'drv-close', liveLat: 24.86, liveLng: 67.01, activeOrderCount: 0 });
    const driverFar = buildStaff({ id: 'drv-far', liveLat: 25.0, liveLng: 68.0, activeOrderCount: 0 });

    mockHaversine
      .mockReturnValueOnce(2) // close driver
      .mockReturnValueOnce(50); // far driver

    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: 24.85, deliveryLng: 67.0 }) },
      staff: {
        findMany: vi.fn().mockResolvedValue([driverClose, driverFar]),
        update: vi.fn().mockResolvedValue(driverClose),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
    mockApplyStatus.mockResolvedValue({} as any);
    mockPrisma.order.findUnique.mockResolvedValue(buildOrder({ id: 'ord-1', orderNumber: 'CH-123' }) as any);

    await assignDriver('ord-1');

    expect(mockTx.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'drv-close' } })
    );
    expect(mockApplyStatus).toHaveBeenCalledWith('ord-1', 'assigned', 'system', { driverId: 'drv-close' });
  });

  it('should fall back to least-busy driver when order has no GPS', async () => {
    const driverBusy = buildStaff({ id: 'drv-busy', activeOrderCount: 3 });
    const driverIdle = buildStaff({ id: 'drv-idle', activeOrderCount: 0 });

    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: null, deliveryLng: null }) },
      staff: {
        findMany: vi.fn().mockResolvedValue([driverBusy, driverIdle]),
        update: vi.fn().mockResolvedValue(driverIdle),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
    mockApplyStatus.mockResolvedValue({} as any);
    mockPrisma.order.findUnique.mockResolvedValue(buildOrder() as any);

    await assignDriver('ord-1');

    expect(mockTx.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'drv-idle' } })
    );
  });

  it('should broadcast NO_DRIVER_AVAILABLE when no candidates exist', async () => {
    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: 24.85, deliveryLng: 67.0 }) },
      staff: { findMany: vi.fn().mockResolvedValue([]) },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

    await assignDriver('ord-1');

    expect(sseManager.broadcastToAdmin).toHaveBeenCalledWith('NO_DRIVER_AVAILABLE', expect.objectContaining({ orderId: 'ord-1' }));
    expect(mockApplyStatus).not.toHaveBeenCalled();
  });

  it('should rollback driver reservation if applyStatusChange fails', async () => {
    const driver = buildStaff({ id: 'drv-1' });

    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: null, deliveryLng: null }) },
      staff: {
        findMany: vi.fn().mockResolvedValue([driver]),
        update: vi.fn().mockResolvedValue(driver),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
    mockApplyStatus.mockRejectedValue(new Error('transition failed'));
    mockPrisma.staff.update.mockResolvedValue({} as any);

    await expect(assignDriver('ord-1')).rejects.toThrow('transition failed');

    expect(mockPrisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'drv-1' },
        data: expect.objectContaining({ driverStatus: 'AVAILABLE' }),
      })
    );
  });

  it('should send SSE notifications after successful assignment', async () => {
    const driver = buildStaff({ id: 'drv-1', fullName: 'Ali Driver' });

    const mockTx = {
      order: { findUnique: vi.fn().mockResolvedValue({ deliveryLat: null, deliveryLng: null }) },
      staff: {
        findMany: vi.fn().mockResolvedValue([driver]),
        update: vi.fn().mockResolvedValue(driver),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
    mockApplyStatus.mockResolvedValue({} as any);
    mockPrisma.order.findUnique.mockResolvedValue(
      buildOrder({ id: 'ord-1', orderNumber: 'CH-999', customer: { name: 'Test' } }) as any
    );

    await assignDriver('ord-1');

    expect(sseManager.sendToDriver).toHaveBeenCalledWith('drv-1', 'NEW_DELIVERY_ASSIGNED', expect.objectContaining({ orderId: 'ord-1' }));
    expect(sseManager.broadcastToAdmin).toHaveBeenCalledWith('DRIVER_ASSIGNED', expect.objectContaining({ driverId: 'drv-1' }));
  });
});

describe('[assignmentService] - manuallyAssignDriver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw if driver not found', async () => {
    mockPrisma.staff.findUnique.mockResolvedValue(null);
    mockPrisma.order.findUnique.mockResolvedValue(buildOrder() as any);

    // manuallyAssignDriver uses Promise.all with findUnique
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(buildOrder() as any);

    await expect(manuallyAssignDriver('ord-1', 'drv-x')).rejects.toThrow('Driver not found');
  });

  it('should throw if driver is not delivery role', async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(buildStaff({ role: 'kitchen' }) as any);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(buildOrder() as any);

    await expect(manuallyAssignDriver('ord-1', 'drv-1')).rejects.toThrow('Staff is not a driver');
  });

  it('should throw if driver is inactive', async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(buildStaff({ role: 'delivery', isActive: false }) as any);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(buildOrder() as any);

    await expect(manuallyAssignDriver('ord-1', 'drv-1')).rejects.toThrow('Driver is not active');
  });

  it('should throw if driver is not verified', async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(
      buildStaff({ role: 'delivery', isActive: true, verificationStatus: 'PENDING' }) as any
    );
    vi.mocked(prisma.order.findUnique).mockResolvedValue(buildOrder() as any);

    await expect(manuallyAssignDriver('ord-1', 'drv-1')).rejects.toThrow('Driver is not verified');
  });

  it('should release previous driver when reassigning', async () => {
    const driver = buildStaff({ id: 'drv-new', role: 'delivery', isActive: true, verificationStatus: 'VERIFIED' });
    const order = buildOrder({ driverId: 'drv-old', items: [] });

    vi.mocked(prisma.staff.findUnique).mockResolvedValue(driver as any);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(order as any);
    mockApplyStatus.mockResolvedValue({} as any);
    mockPrisma.staff.update.mockResolvedValue({} as any);

    await manuallyAssignDriver('ord-1', 'drv-new');

    // Should release old driver
    expect(mockPrisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'drv-old' },
        data: expect.objectContaining({ driverStatus: 'AVAILABLE' }),
      })
    );
  });

  it('should throw if order not found', async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue(buildStaff({ role: 'delivery' }) as any);
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    await expect(manuallyAssignDriver('ord-x', 'drv-1')).rejects.toThrow('Order not found');
  });
});
