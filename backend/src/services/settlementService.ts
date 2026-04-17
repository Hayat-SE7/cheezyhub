// ─────────────────────────────────────────────────────
//  SETTLEMENT SERVICE  — Phase 7
//  Immutable COD settlement — every change is a record.
//  codPending is ONLY modified through this service.
// ─────────────────────────────────────────────────────

import { prisma }     from '../config/db';
import { sseManager } from './sseManager';

export async function settleCOD(
  driverId:        string,
  submittedAmount: number,
  notes:           string | undefined,
  settledBy:       string,
) {
  if (submittedAmount < 0) throw new Error('Amount cannot be negative');

  // Interactive transaction: read + validate + write atomically to prevent double-settlement
  const settlement = await prisma.$transaction(async (tx) => {
    const driver = await tx.staff.findUnique({ where: { id: driverId } });

    if (!driver)                    throw new Error('Driver not found');
    if (driver.role !== 'delivery') throw new Error('Staff is not a driver');
    if (driver.codPending <= 0)     throw new Error('Driver has no pending COD');

    const remainingAmount = Math.max(0, driver.codPending - submittedAmount);

    const record = await tx.driverSettlement.create({
      data: {
        driverId,
        collectedAmount: driver.codPending,
        submittedAmount,
        remainingAmount,
        notes,
        settledBy,
      },
    });

    await tx.staff.update({
      where: { id: driverId },
      data:  { codPending: remainingAmount },
    });

    return { record, remainingAmount };
  });

  sseManager.sendToDriver(driverId, 'COD_SETTLED', {
    settledAmount:   submittedAmount,
    remainingAmount: settlement.remainingAmount,
    message: `Settlement recorded. Remaining: Rs.${settlement.remainingAmount.toFixed(0)}`,
  });

  return settlement.record;
}

export async function getAllSettlements(filters: {
  driverId?: string;
  from?:     Date;
  to?:       Date;
}) {
  return prisma.driverSettlement.findMany({
    where: {
      ...(filters.driverId && { driverId: filters.driverId }),
      ...((filters.from || filters.to) && {
        createdAt: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to   && { lte: filters.to   }),
        },
      }),
    },
    include: {
      driver: { select: { id: true, username: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
