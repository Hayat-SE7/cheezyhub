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
  const driver = await prisma.staff.findUnique({ where: { id: driverId } });

  if (!driver)                    throw new Error('Driver not found');
  if (driver.role !== 'delivery') throw new Error('Staff is not a driver');
  if (submittedAmount < 0)        throw new Error('Amount cannot be negative');
  if (driver.codPending <= 0)     throw new Error('Driver has no pending COD');

  const remainingAmount = Math.max(0, driver.codPending - submittedAmount);

  const [settlement] = await prisma.$transaction([
    prisma.driverSettlement.create({
      data: {
        driverId,
        collectedAmount: driver.codPending,
        submittedAmount,
        remainingAmount,
        notes,
        settledBy,
      },
    }),
    prisma.staff.update({
      where: { id: driverId },
      data:  { codPending: remainingAmount },
    }),
  ]);

  sseManager.sendToDriver(driverId, 'COD_SETTLED', {
    settledAmount:   submittedAmount,
    remainingAmount,
    message: `Settlement recorded. Remaining: Rs.${remainingAmount.toFixed(0)}`,
  });

  return settlement;
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
