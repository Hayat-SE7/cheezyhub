// ─────────────────────────────────────────────────────
//  DELIVERY ROUTE  — Complete
//  Handles:
//    ✅ Driver's active orders list
//    ✅ Paginated order history
//    ✅ Status: assigned → picked_up → delivered (auto-completes)
//    ✅ Ownership check (driver can only update their own orders)
//    ✅ Google Maps redirect URL generation
//    ✅ Driver status toggle (AVAILABLE / OFFLINE)
//    ✅ Driver profile get/update + verification flow
//    ✅ COD wallet (pending cash + recent COD orders + settlements)
//    ✅ Settlement history
//    ✅ Earnings stats + 7-day breakdown
//    ✅ Holiday requests (list, create, cancel)
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { applyStatusChange } from '../services/orderLifecycle';
import { AppError } from '../middleware/errorHandler';
import { OrderStatus } from '@prisma/client';

export const deliveryRouter = Router();

// All delivery routes require delivery or admin role
deliveryRouter.use(authenticate, requireRole('delivery', 'admin'));

// ─── GET /api/delivery/orders ─────────────────────────
//     This driver's active assignments (assigned + picked_up)

deliveryRouter.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  const orders = await prisma.order.findMany({
    where: {
      driverId: req.user!.userId,
      status: { in: ['assigned', 'picked_up'] },
    },
    include: {
      items: { select: { menuItemName: true, quantity: true } },
      customer: { select: { id: true, name: true, mobile: true } },
    },
    orderBy: { updatedAt: 'asc' },
  });
  res.json({ success: true, data: orders });
});

// ─── GET /api/delivery/orders/history ─────────────────
//     Paginated completed deliveries for this driver

deliveryRouter.get('/orders/history', async (req: AuthenticatedRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip  = (page - 1) * limit;

  const where = {
    driverId: req.user!.userId,
    status: { in: ['completed', 'delivered'] as OrderStatus[] },
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: { select: { menuItemName: true, quantity: true } },
        customer: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── PATCH /api/delivery/orders/:id/status ─────────────
//     Driver updates: assigned → picked_up → delivered
//     On "delivered", system auto-transitions to "completed"

deliveryRouter.patch(
  '/orders/:id/status',
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ success: false, error: 'Status is required' });
      return;
    }

    try {
      // Load order to verify ownership
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) throw new AppError('Order not found', 404);

      // Ownership check: drivers can only update THEIR assigned orders
      // Admins can update any order
      if (req.user!.role === 'delivery' && order.driverId !== req.user!.userId) {
        throw new AppError('This order is not assigned to you', 403);
      }

      // Apply transition via lifecycle engine
      // Engine handles SSE broadcasts + WhatsApp notifications + auto-complete
      const updated = await applyStatusChange(id, status as OrderStatus, req.user!.role);

      res.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
      } else {
        console.error('[Delivery] Error:', err);
        res.status(500).json({ success: false, error: 'Failed to update delivery status' });
      }
    }
  }
);

// ─── GET /api/delivery/orders/:id/maps ────────────────
//     Returns a Google Maps URL for the delivery address
//     Driver app opens this to navigate

deliveryRouter.get(
  '/orders/:id/maps',
  async (req: AuthenticatedRequest, res: Response) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { driverId: true, deliveryLat: true, deliveryLng: true, deliveryAddress: true },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    if (req.user!.role === 'delivery' && order.driverId !== req.user!.userId) {
      res.status(403).json({ success: false, error: 'Not your order' });
      return;
    }

    // Build Google Maps URL
    const query = order.deliveryLat
      ? `${order.deliveryLat},${order.deliveryLng}`
      : encodeURIComponent(order.deliveryAddress);

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`;

    res.json({ success: true, data: { mapsUrl } });
  }
);

// ─── PATCH /api/delivery/status ───────────────────────
//     Toggle driver status: AVAILABLE ↔ OFFLINE

deliveryRouter.patch('/status', async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;

  if (!status || !['AVAILABLE', 'OFFLINE'].includes(status)) {
    res.status(400).json({ success: false, error: 'Status must be AVAILABLE or OFFLINE' });
    return;
  }

  try {
    const staff = await prisma.staff.update({
      where: { id: req.user!.userId },
      data: { driverStatus: status },
      select: { id: true, driverStatus: true },
    });

    res.json({ success: true, data: staff });
  } catch (err) {
    console.error('[Delivery] Status toggle error:', err);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// ─── GET /api/delivery/profile ────────────────────────
//     Returns full driver profile including documents

deliveryRouter.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, username: true, fullName: true, phone: true, role: true,
        vehicleType: true, vehiclePlate: true, emergencyContact: true,
        cnic: true, cnicFrontUrl: true, cnicBackUrl: true,
        licensePhotoUrl: true, profilePhotoUrl: true,
        verificationStatus: true, verificationNote: true,
        driverStatus: true, codPending: true,
        totalDeliveries: true, todayDeliveries: true, activeOrderCount: true,
        createdAt: true,
      },
    });

    if (!staff) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    res.json({ success: true, data: staff });
  } catch (err) {
    console.error('[Delivery] Profile fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to load profile' });
  }
});

// ─── PATCH /api/delivery/profile ──────────────────────
//     Update driver profile; auto-set UNDER_REVIEW if docs submitted

deliveryRouter.patch('/profile', async (req: AuthenticatedRequest, res: Response) => {
  const allowedFields = [
    'fullName', 'phone', 'cnic', 'vehicleType', 'vehiclePlate',
    'emergencyContact', 'cnicFrontUrl', 'cnicBackUrl',
    'licensePhotoUrl', 'profilePhotoUrl',
  ];

  const data: Record<string, string> = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      data[key] = req.body[key];
    }
  }

  // Auto-set verification status to UNDER_REVIEW if all 3 required docs are provided
  const docFields = ['cnicFrontUrl', 'cnicBackUrl', 'licensePhotoUrl'];
  const current = await prisma.staff.findUnique({
    where: { id: req.user!.userId },
    select: { cnicFrontUrl: true, cnicBackUrl: true, licensePhotoUrl: true, verificationStatus: true },
  });

  if (current) {
    const merged = { ...current, ...data };
    const allDocsPresent = docFields.every((f) => merged[f as keyof typeof merged]);

    if (allDocsPresent && current.verificationStatus === 'PENDING') {
      (data as any).verificationStatus = 'UNDER_REVIEW';
    }
  }

  try {
    const updated = await prisma.staff.update({
      where: { id: req.user!.userId },
      data,
      select: {
        id: true, fullName: true, phone: true, verificationStatus: true,
        vehicleType: true, vehiclePlate: true,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Delivery] Profile update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// ─── GET /api/delivery/cod ────────────────────────────
//     COD wallet: pending balance + recent COD orders + settlements

deliveryRouter.get('/cod', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [staff, recentCODOrders, settlements] = await Promise.all([
      prisma.staff.findUnique({
        where: { id: req.user!.userId },
        select: { codPending: true },
      }),
      prisma.order.findMany({
        where: {
          driverId: req.user!.userId,
          paymentMethod: 'cash',
          status: { in: ['completed', 'delivered'] as OrderStatus[] },
        },
        select: { id: true, orderNumber: true, total: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.driverSettlement.findMany({
        where: { driverId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      success: true,
      data: {
        wallet: { codPending: staff?.codPending ?? 0 },
        recentCODOrders,
        settlements,
      },
    });
  } catch (err) {
    console.error('[Delivery] COD fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to load COD data' });
  }
});

// ─── GET /api/delivery/settlements ────────────────────
//     Full settlement history for this driver

deliveryRouter.get('/settlements', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settlements = await prisma.driverSettlement.findMany({
      where: { driverId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: settlements });
  } catch (err) {
    console.error('[Delivery] Settlements fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to load settlements' });
  }
});

// ─── GET /api/delivery/earnings ───────────────────────
//     Stats + 7-day daily breakdown

deliveryRouter.get('/earnings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const driverId = req.user!.userId;

    // Today start
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Week start (7 days ago)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const [staff, todayOrders, weekOrders, totalOrders] = await Promise.all([
      prisma.staff.findUnique({
        where: { id: driverId },
        select: { codPending: true, totalDeliveries: true },
      }),
      prisma.order.count({
        where: { driverId, status: 'completed', updatedAt: { gte: todayStart } },
      }),
      prisma.order.findMany({
        where: { driverId, status: 'completed', updatedAt: { gte: weekStart } },
        select: { total: true, paymentMethod: true, updatedAt: true },
      }),
      prisma.order.count({
        where: { driverId, status: 'completed' },
      }),
    ]);

    // Build 7-day breakdown
    const dailyMap: Record<string, { count: number; cod: number }> = {};
    for (const order of weekOrders) {
      const dateKey = order.updatedAt.toISOString().split('T')[0];
      if (!dailyMap[dateKey]) dailyMap[dateKey] = { count: 0, cod: 0 };
      dailyMap[dateKey].count++;
      if (order.paymentMethod === 'cash') dailyMap[dateKey].cod += order.total;
    }

    const dailyBreakdown = Object.entries(dailyMap)
      .map(([date, d]) => ({ date, count: d.count, cod: d.cod }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        todayDeliveries: todayOrders,
        weeklyDeliveries: weekOrders.length,
        totalDeliveries: staff?.totalDeliveries ?? totalOrders,
        codPending: staff?.codPending ?? 0,
        dailyBreakdown,
      },
    });
  } catch (err) {
    console.error('[Delivery] Earnings fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to load earnings' });
  }
});

// ─── GET /api/delivery/holidays ───────────────────────
//     This driver's holiday requests

deliveryRouter.get('/holidays', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await prisma.holidayRequest.findMany({
      where: { driverId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('[Delivery] Holidays fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to load holiday requests' });
  }
});

// ─── POST /api/delivery/holidays ──────────────────────
//     Submit a new holiday request

deliveryRouter.post('/holidays', async (req: AuthenticatedRequest, res: Response) => {
  const { fromDate, toDate, reason } = req.body;

  if (!fromDate || !toDate || !reason) {
    res.status(400).json({ success: false, error: 'fromDate, toDate, and reason are required' });
    return;
  }

  const from = new Date(fromDate);
  const to   = new Date(toDate);
  if (from >= to) {
    res.status(400).json({ success: false, error: 'End date must be after start date' });
    return;
  }

  try {
    const request = await prisma.holidayRequest.create({
      data: {
        driverId: req.user!.userId,
        fromDate: from,
        toDate: to,
        reason,
      },
    });
    res.status(201).json({ success: true, data: request });
  } catch (err) {
    console.error('[Delivery] Holiday create error:', err);
    res.status(500).json({ success: false, error: 'Failed to create holiday request' });
  }
});

// ─── PATCH /api/delivery/holidays/:id ─────────────────
//     Cancel a pending holiday request (driver can only cancel their own)

deliveryRouter.patch('/holidays/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await prisma.holidayRequest.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Request not found' });
      return;
    }

    if (existing.driverId !== req.user!.userId) {
      res.status(403).json({ success: false, error: 'Not your request' });
      return;
    }

    if (existing.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Only pending requests can be cancelled' });
      return;
    }

    await prisma.holidayRequest.delete({ where: { id } });
    res.json({ success: true, message: 'Holiday request cancelled' });
  } catch (err) {
    console.error('[Delivery] Holiday cancel error:', err);
    res.status(500).json({ success: false, error: 'Failed to cancel holiday request' });
  }
});
