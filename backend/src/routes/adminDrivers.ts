// ─────────────────────────────────────────────────────
//  ADMIN DRIVER ROUTES  — Phase 7
//  Mount at: /api/admin  (uses sub-paths internally)
//
//  /api/admin/drivers              GET, POST
//  /api/admin/drivers/:id          GET, PATCH
//  /api/admin/drivers/:id/verify   PATCH
//  /api/admin/drivers/:id/assign   PATCH
//  /api/admin/settlements          GET, POST
//  /api/admin/holiday-requests     GET
//  /api/admin/holiday-requests/:id PATCH
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { z }                from 'zod';
import bcrypt               from 'bcryptjs';
import { prisma }           from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { sseManager }       from '../services/sseManager';
import { settleCOD, getAllSettlements } from '../services/settlementService';
import { manuallyAssignDriver }         from '../services/assignmentService';

export const adminDriverRouter = Router();
adminDriverRouter.use(authenticate, requireRole('admin'));

// ─── GET /drivers ─────────────────────────────────────

adminDriverRouter.get('/drivers', async (_req: AuthenticatedRequest, res: Response) => {
  const drivers = await prisma.staff.findMany({
    where:   { role: 'delivery' },
    select:  {
      id: true, username: true, fullName: true, phone: true,
      vehicleType: true, vehiclePlate: true, isActive: true,
      driverStatus: true, verificationStatus: true,
      codPending: true, totalDeliveries: true, todayDeliveries: true,
      activeOrderCount: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: drivers });
});

// ─── POST /drivers ────────────────────────────────────

const createDriverSchema = z.object({
  username: z.string().min(3).max(30),
  pin:      z.string().min(4).max(6),
  fullName: z.string().min(2).max(100).optional(),
  phone:    z.string().optional(),
});

adminDriverRouter.post('/drivers', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createDriverSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const { username, pin, fullName, phone } = parsed.data;
  const exists = await prisma.staff.findUnique({ where: { username } });
  if (exists) { res.status(409).json({ success: false, error: 'Username already taken' }); return; }

  const driver = await prisma.staff.create({
    data:   { username, pinHash: await bcrypt.hash(pin, 10), role: 'delivery', fullName, phone, isActive: true },
    select: { id: true, username: true, fullName: true, role: true, createdAt: true },
  });

  res.status(201).json({ success: true, data: driver });
});

// ─── GET /drivers/:id ─────────────────────────────────

adminDriverRouter.get('/drivers/:id', async (req: AuthenticatedRequest, res: Response) => {
  const driver = await prisma.staff.findUnique({
    where:  { id: req.params.id },
    select: {
      id: true, username: true, fullName: true, phone: true, cnic: true,
      vehicleType: true, vehiclePlate: true, emergencyContact: true,
      cnicFrontUrl: true, cnicBackUrl: true, licensePhotoUrl: true, profilePhotoUrl: true,
      verificationStatus: true, verificationNote: true, verifiedAt: true, verifiedBy: true,
      driverStatus: true, codPending: true, totalDeliveries: true,
      todayDeliveries: true, activeOrderCount: true, isActive: true, createdAt: true,
      settlements:     { orderBy: { createdAt: 'desc' }, take: 10 },
      holidayRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
      deliveries: {
        where:   { status: { in: ['completed', 'delivered', 'assigned', 'picked_up'] } },
        select:  { id: true, orderNumber: true, total: true, status: true, updatedAt: true,
                   customer: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take:    20,
      },
    },
  });

  if (!driver) { res.status(404).json({ success: false, error: 'Driver not found' }); return; }
  res.json({ success: true, data: driver });
});

// ─── PATCH /drivers/:id ───────────────────────────────

adminDriverRouter.patch('/drivers/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { isActive, pin } = req.body;
  const updateData: any   = {};

  if (typeof isActive === 'boolean') updateData.isActive = isActive;
  if (pin) {
    if (pin.length < 4 || pin.length > 6) {
      res.status(400).json({ success: false, error: 'PIN must be 4–6 digits' });
      return;
    }
    updateData.pinHash = await bcrypt.hash(pin, 10);
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ success: false, error: 'Nothing to update' });
    return;
  }

  const updated = await prisma.staff.update({
    where:  { id: req.params.id },
    data:   updateData,
    select: { id: true, username: true, isActive: true },
  });
  res.json({ success: true, data: updated });
});

// ─── PATCH /drivers/:id/verify ────────────────────────

const verifySchema = z.object({
  action: z.enum(['approve', 'reject']),
  note:   z.string().max(500).optional(),
});

adminDriverRouter.patch('/drivers/:id/verify', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const { action, note } = parsed.data;
  const driver = await prisma.staff.findUnique({ where: { id: req.params.id } });
  if (!driver) { res.status(404).json({ success: false, error: 'Driver not found' }); return; }
  if (driver.verificationStatus !== 'UNDER_REVIEW') {
    res.status(400).json({ success: false, error: `Driver is ${driver.verificationStatus}, not UNDER_REVIEW` });
    return;
  }

  const newStatus = action === 'approve' ? 'VERIFIED' : 'REJECTED';

  const updated = await prisma.staff.update({
    where:  { id: req.params.id },
    data:   {
      verificationStatus: newStatus as any,
      verificationNote:   note ?? null,
      verifiedAt:         action === 'approve' ? new Date()       : null,
      verifiedBy:         action === 'approve' ? req.user!.userId : null,
    },
    select: { id: true, username: true, fullName: true, verificationStatus: true },
  });

  sseManager.sendToDriver(req.params.id, 'VERIFICATION_REVIEWED', {
    status:  newStatus,
    message: action === 'approve'
      ? 'Your profile has been verified! You can now go online.'
      : `Verification rejected: ${note ?? 'Please resubmit your documents.'}`,
  });

  res.json({ success: true, data: updated });
});

// ─── PATCH /drivers/:id/assign ────────────────────────

adminDriverRouter.patch('/drivers/:id/assign', async (req: AuthenticatedRequest, res: Response) => {
  const { orderId } = req.body;
  if (!orderId) { res.status(400).json({ success: false, error: 'orderId is required' }); return; }

  try {
    await manuallyAssignDriver(orderId, req.params.id);
    res.json({ success: true, message: 'Driver assigned successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /settlements ────────────────────────────────

const settlementSchema = z.object({
  driverId:        z.string(),
  submittedAmount: z.number().positive(),
  notes:           z.string().max(500).optional(),
});

adminDriverRouter.post('/settlements', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = settlementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  try {
    const settlement = await settleCOD(parsed.data.driverId, parsed.data.submittedAmount, parsed.data.notes, req.user!.userId);
    res.status(201).json({ success: true, data: settlement });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /settlements ─────────────────────────────────

adminDriverRouter.get('/settlements', async (req: AuthenticatedRequest, res: Response) => {
  const { driverId, from, to } = req.query as Record<string, string>;
  const settlements = await getAllSettlements({
    driverId,
    from: from ? new Date(from) : undefined,
    to:   to   ? new Date(to)   : undefined,
  });
  res.json({ success: true, data: settlements });
});

// ─── GET /holiday-requests ────────────────────────────

adminDriverRouter.get('/holiday-requests', async (req: AuthenticatedRequest, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  const requests = await prisma.holidayRequest.findMany({
    where:   { ...(statusFilter && { status: statusFilter as any }) },
    include: { driver: { select: { id: true, username: true, fullName: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: requests });
});

// ─── PATCH /holiday-requests/:id ─────────────────────

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note:   z.string().max(500).optional(),
});

adminDriverRouter.patch('/holiday-requests/:id', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const { action, note } = parsed.data;
  const request = await prisma.holidayRequest.findUnique({ where: { id: req.params.id } });

  if (!request) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
  if (request.status !== 'PENDING') { res.status(400).json({ success: false, error: 'Request is no longer pending' }); return; }

  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

  const updated = await prisma.holidayRequest.update({
    where: { id: req.params.id },
    data:  { status: newStatus as any, reviewedBy: req.user!.userId, reviewNote: note ?? null },
  });

  // If approved, enforce: set driver OFFLINE and check for active order conflicts
  if (action === 'approve') {
    const driver = await prisma.staff.findUnique({
      where: { id: request.driverId },
      select: { driverStatus: true, activeOrderCount: true },
    });

    await prisma.staff.update({
      where: { id: request.driverId },
      data: { driverStatus: 'OFFLINE' },
    });

    sseManager.sendToDriver(request.driverId, 'DRIVER_STATUS_CHANGED', {
      driverStatus: 'OFFLINE',
    });

    if (driver && driver.activeOrderCount > 0) {
      sseManager.broadcastToAdmin('HOLIDAY_CONFLICT', {
        driverId: request.driverId,
        message: `Driver has ${driver.activeOrderCount} active order(s) during approved holiday. Please reassign.`,
      });
    }
  }

  sseManager.sendToDriver(request.driverId, 'HOLIDAY_REQUEST_REVIEWED', {
    status:   newStatus,
    fromDate: request.fromDate,
    toDate:   request.toDate,
    message:  action === 'approve'
      ? 'Your holiday request has been approved! You have been set to offline.'
      : `Holiday request rejected: ${note ?? 'Contact admin.'}`,
  });

  res.json({ success: true, data: updated });
});
