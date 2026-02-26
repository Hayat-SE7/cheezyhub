// ─────────────────────────────────────────────────────
//  ADMIN ROUTE
//  Full system control:
//    ✅ Order management (view all, cancel, assign driver)
//    ✅ Staff management (create, toggle active)
//    ✅ System settings (fees, radius, restaurant info)
//    ✅ Dashboard statistics
//    ✅ Driver assignment (ready → assigned via lifecycle engine)
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { applyStatusChange } from '../services/orderLifecycle';
import { whatsappService } from '../services/whatsapp';
import { AppError } from '../middleware/errorHandler';

export const adminRouter = Router();

// All admin routes require admin role
adminRouter.use(authenticate, requireRole('admin'));

// ═══════════════════════════════════════════════════════
//  STAFF MANAGEMENT
// ═══════════════════════════════════════════════════════

// GET /api/admin/staff
adminRouter.get('/staff', async (_req, res: Response) => {
  const staff = await prisma.staff.findMany({
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: staff });
});

// POST /api/admin/staff — create a new staff account
adminRouter.post('/staff', async (req: AuthenticatedRequest, res: Response) => {
  const { username, pin, role } = req.body;

  if (!username || !pin || !role) {
    res.status(400).json({ success: false, error: 'username, pin, and role are required' });
    return;
  }

  if (!['kitchen', 'delivery', 'admin'].includes(role)) {
    res.status(400).json({ success: false, error: 'Role must be: kitchen, delivery, or admin' });
    return;
  }

  if (String(pin).length < 4) {
    res.status(400).json({ success: false, error: 'PIN must be at least 4 digits' });
    return;
  }

  try {
    const pinHash = await bcrypt.hash(String(pin), 10);
    const staff = await prisma.staff.create({
      data: { username, pinHash, role },
      select: { id: true, username: true, role: true, isActive: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: staff });
  } catch {
    res.status(409).json({ success: false, error: 'Username already exists' });
  }
});

// PATCH /api/admin/staff/:id — toggle active / reset PIN
adminRouter.patch('/staff/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { isActive, pin } = req.body;

  const data: any = {};
  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (pin) data.pinHash = await bcrypt.hash(String(pin), 10);

  const staff = await prisma.staff.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true, isActive: true },
  });
  res.json({ success: true, data: staff });
});

// DELETE /api/admin/staff/:id
adminRouter.delete('/staff/:id', async (req: AuthenticatedRequest, res: Response) => {
  await prisma.staff.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Staff account deleted' });
});

// ═══════════════════════════════════════════════════════
//  ORDER MANAGEMENT
// ═══════════════════════════════════════════════════════

// GET /api/admin/orders — all orders, paginated + filterable
adminRouter.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  const { status, page = '1', limit = '25', search } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { deliveryAddress: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        customer: { select: { id: true, name: true, mobile: true } },
        driver: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items: orders,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// PATCH /api/admin/orders/:id/assign — assign a driver (ready → assigned)
adminRouter.patch(
  '/orders/:id/assign',
  async (req: AuthenticatedRequest, res: Response) => {
    const { driverId } = req.body;

    if (!driverId) {
      res.status(400).json({ success: false, error: 'driverId is required' });
      return;
    }

    // Verify driver exists and is active
    const driver = await prisma.staff.findFirst({
      where: { id: driverId, role: 'delivery', isActive: true },
    });

    if (!driver) {
      res.status(404).json({ success: false, error: 'Active driver not found' });
      return;
    }

    try {
      // Lifecycle engine: ready → assigned (admin only)
      // Also sets driverId on the order
      const updated = await applyStatusChange(req.params.id, 'assigned', 'admin', {
        driverId,
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
      } else {
        res.status(500).json({ success: false, error: 'Assignment failed' });
      }
    }
  }
);

// PATCH /api/admin/orders/:id/cancel
adminRouter.patch(
  '/orders/:id/cancel',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await applyStatusChange(req.params.id, 'cancelled', 'admin');
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ success: false, error: err.message });
      } else {
        res.status(500).json({ success: false, error: 'Cancellation failed' });
      }
    }
  }
);

// ═══════════════════════════════════════════════════════
//  SYSTEM SETTINGS
// ═══════════════════════════════════════════════════════

// GET /api/admin/settings
adminRouter.get('/settings', async (_req, res: Response) => {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: {} });
  }
  res.json({ success: true, data: settings });
});

// PATCH /api/admin/settings
adminRouter.patch('/settings', async (req: AuthenticatedRequest, res: Response) => {
  // Only allow known fields to prevent injection
  const allowed = [
    'deliveryFee', 'serviceCharge', 'deliveryRadiusKm',
    'restaurantLat', 'restaurantLng', 'ordersAccepting',
    'restaurantName', 'restaurantPhone',
  ];

  const data: any = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = req.body[key];
  }

  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({ data });
  } else {
    settings = await prisma.systemSettings.update({ where: { id: settings.id }, data });
  }

  res.json({ success: true, data: settings });
});

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════

// GET /api/admin/drivers — active delivery staff
adminRouter.get('/drivers', async (_req, res: Response) => {
  const drivers = await prisma.staff.findMany({
    where: { role: 'delivery', isActive: true },
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  });
  res.json({ success: true, data: drivers });
});

// GET /api/admin/stats — dashboard metrics
adminRouter.get('/stats', async (_req, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── paymentStatus: 'pending' = Safepay order awaiting payment confirmation.
  // Exclude these from all counts — they are not real orders yet.
  const CONFIRMED_PAYMENT = { NOT: { paymentStatus: 'pending' } };

  const [totalOrders, todayOrders, activeOrders, revenueResult, openTickets, pendingCount] =
    await Promise.all([
      prisma.order.count({ where: { status: { not: 'cancelled' }, ...CONFIRMED_PAYMENT } }),
      prisma.order.count({ where: { createdAt: { gte: today }, status: { not: 'cancelled' }, ...CONFIRMED_PAYMENT } }),
      prisma.order.count({
        where: { status: { in: ['pending', 'preparing', 'ready', 'assigned', 'picked_up'] }, ...CONFIRMED_PAYMENT },
      }),
      prisma.order.aggregate({
        where: { status: 'completed' },
        _sum: { total: true },
      }),
      prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      prisma.order.count({ where: { status: 'pending', ...CONFIRMED_PAYMENT } }),
    ]);

  res.json({
    success: true,
    data: {
      totalOrders,
      todayOrders,
      activeOrders,
      pendingOrders: pendingCount,
      totalRevenue: revenueResult._sum.total ?? 0,
      openTickets,
    },
  });
});

// GET /api/admin/notifications — WhatsApp notification log (last 100)
adminRouter.get('/notifications', async (_req: AuthenticatedRequest, res: Response) => {
  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: logs });
});

// POST /api/admin/notifications/:id/retry — retry a failed WhatsApp message
adminRouter.post('/notifications/:id/retry', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    await whatsappService.retry(id);
    res.json({ success: true, message: 'Message resent successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message ?? 'Retry failed' });
  }
});

// ═══════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════

// GET /api/admin/analytics — chart data for dashboard
adminRouter.get('/analytics', async (_req, res: Response) => {
  const now = new Date();

  // Last 7 days range
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Fetch all completed orders in the last 7 days
  const recentOrders = await prisma.order.findMany({
    where: {
      status: 'completed',
      createdAt: { gte: sevenDaysAgo },
    },
    include: { items: { select: { menuItemName: true, quantity: true, totalPrice: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Orders + revenue per day
  const dailyMap = new Map<string, { orders: number; revenue: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { orders: 0, revenue: 0 });
  }
  for (const order of recentOrders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const day = dailyMap.get(key);
    if (day) {
      day.orders  += 1;
      day.revenue += order.total;
    }
  }
  const daily = Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v }));

  // Peak hours (0-23)
  const hourMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourMap.set(h, 0);
  for (const order of recentOrders) {
    const h = new Date(order.createdAt).getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  const hourly = Array.from(hourMap.entries()).map(([hour, orders]) => ({ hour, orders }));

  // Top selling items (all time)
  const itemAgg = await prisma.orderItem.groupBy({
    by: ['menuItemName'],
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 8,
  });
  const topItems = itemAgg.map((i) => ({
    name: i.menuItemName,
    quantity: i._sum.quantity ?? 0,
    revenue: Math.round((i._sum.totalPrice ?? 0) * 100) / 100,
  }));

  res.json({
    success: true,
    data: { daily, hourly, topItems },
  });
});
