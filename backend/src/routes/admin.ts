// ─────────────────────────────────────────────────────────────────
//  ADMIN ROUTE — Phase 11 (complete rebuild)
//  ✅ Staff: list, profile, create, patch, delete, reset-pin
//  ✅ Customers: search/filter/sort/export CSV/block/notes/tags/at-risk
//  ✅ Orders: list, assign driver, cancel
//  ✅ Menu CRUD, Deals CRUD
//  ✅ Settings, stats, analytics, drivers, notifications
// ─────────────────────────────────────────────────────────────────

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { applyStatusChange } from '../services/orderLifecycle';
import { AppError } from '../middleware/errorHandler';
import { toCsv, csvHeaders } from '../utils/csv';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));

// ─── STAFF ──────────────────────────────────────────────────────

adminRouter.get('/staff', async (_req, res: Response) => {
  const staff = await prisma.staff.findMany({
    select: { id: true, username: true, role: true, isActive: true, fullName: true, phone: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: staff });
});

adminRouter.get('/staff/:id', async (req: AuthenticatedRequest, res: Response) => {
  const member = await prisma.staff.findUnique({
    where: { id: req.params.id },
    select: { id: true, username: true, role: true, isActive: true, fullName: true, phone: true, lastLoginAt: true, createdAt: true },
  });
  if (!member) { res.status(404).json({ success: false, error: 'Staff not found' }); return; }

  let extra: Record<string, any> = {};
  if (member.role === 'delivery') {
    const [agg, recent] = await Promise.all([
      prisma.order.aggregate({ where: { driverId: member.id, status: 'completed' }, _count: { id: true }, _sum: { total: true } }),
      prisma.order.findMany({ where: { driverId: member.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, orderNumber: true, total: true, status: true, createdAt: true } }),
    ]);
    extra = { totalDeliveryCount: agg._count.id, totalRevenue: Math.round((agg._sum.total ?? 0) * 100) / 100, recentDeliveries: recent };
  }
  res.json({ success: true, data: { ...member, ...extra } });
});

adminRouter.post('/staff', async (req: AuthenticatedRequest, res: Response) => {
  const { username, pin, role, fullName, phone } = req.body;
  if (!username || !pin || !role) { res.status(400).json({ success: false, error: 'username, pin, and role are required' }); return; }
  if (!['kitchen', 'delivery', 'admin', 'cashier'].includes(role)) { res.status(400).json({ success: false, error: 'Invalid role' }); return; }
  if (String(pin).length < 4) { res.status(400).json({ success: false, error: 'PIN must be at least 4 digits' }); return; }
  try {
    const pinHash = await bcrypt.hash(String(pin), 10);
    const staff = await prisma.staff.create({
      data: { username, pinHash, role, fullName: fullName || null, phone: phone || null },
      select: { id: true, username: true, role: true, isActive: true, fullName: true, phone: true, lastLoginAt: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: staff });
  } catch { res.status(409).json({ success: false, error: 'Username already exists' }); }
});

adminRouter.patch('/staff/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { isActive, pin, fullName, phone, role } = req.body;
  const data: any = {};
  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (pin !== undefined) data.pinHash = await bcrypt.hash(String(pin), 10);
  if (fullName !== undefined) data.fullName = fullName;
  if (phone !== undefined) data.phone = phone;
  if (role !== undefined) data.role = role;
  const staff = await prisma.staff.update({ where: { id: req.params.id }, data, select: { id: true, username: true, role: true, isActive: true, fullName: true, phone: true, lastLoginAt: true } });
  res.json({ success: true, data: staff });
});

adminRouter.delete('/staff/:id', async (req: AuthenticatedRequest, res: Response) => {
  await prisma.staff.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

adminRouter.post('/staff/:id/reset-pin', async (req: AuthenticatedRequest, res: Response) => {
  const { newPin } = req.body;
  if (!newPin || String(newPin).length < 4) { res.status(400).json({ success: false, error: 'PIN must be at least 4 digits' }); return; }
  await prisma.staff.update({ where: { id: req.params.id }, data: { pinHash: await bcrypt.hash(String(newPin), 10) } });
  res.json({ success: true, message: 'PIN reset successfully' });
});

// ─── CUSTOMERS ───────────────────────────────────────────────────

adminRouter.get('/customers', async (req: AuthenticatedRequest, res: Response) => {
  const { page = '1', limit = '25', search, status, sort, atRisk } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = Math.min(parseInt(limit), 100);

  const where: any = {};
  if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { mobile: { contains: search } }, { email: { contains: search, mode: 'insensitive' } }];
  if (status === 'blocked') where.isBlocked = true;
  if (status === 'active') where.isBlocked = false;

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, mobile: true, email: true, isBlocked: true, adminNote: true, tags: true, createdAt: true,
        _count: { select: { orders: true, addresses: true } },
        orders: { where: { status: 'completed' }, select: { total: true, createdAt: true }, orderBy: { createdAt: 'desc' } }
      },
      skip, take: limitNum, orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  let rows = customers.map((c) => {
    const totalSpent = c.orders.reduce((s, o) => s + o.total, 0);
    const lastOrderAt = c.orders[0]?.createdAt ?? null;
    const isAtRisk = c._count.orders >= 5 && lastOrderAt ? new Date(lastOrderAt) < cutoff : false;
    return {
      id: c.id, name: c.name, mobile: c.mobile, email: c.email,
      isBlocked: c.isBlocked, adminNote: c.adminNote,
      tags: (c as any).tags ?? [],
      createdAt: c.createdAt,
      totalOrders: c._count.orders,
      totalSpent: Math.round(totalSpent * 100) / 100,
      addressCount: c._count.addresses,
      lastOrderAt, isAtRisk,
    };
  });

  if (sort === 'spent')  rows.sort((a, b) => b.totalSpent - a.totalSpent);
  if (sort === 'orders') rows.sort((a, b) => b.totalOrders - a.totalOrders);
  if (sort === 'recent') rows.sort((a, b) => (!a.lastOrderAt ? 1 : !b.lastOrderAt ? -1 : new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()));
  if (atRisk === 'true') rows = rows.filter((r) => r.isAtRisk);

  res.json({ success: true, data: rows, total, page: parseInt(page), limit: limitNum });
});

adminRouter.get('/customers/:id', async (req: AuthenticatedRequest, res: Response) => {
  const customer = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, name: true, mobile: true, email: true, isBlocked: true, adminNote: true, tags: true, createdAt: true,
      addresses: { orderBy: { createdAt: 'desc' } },
      orders: { orderBy: { createdAt: 'desc' }, take: 50, include: { items: { select: { menuItemName: true, quantity: true, totalPrice: true } } } },
    }
  });
  if (!customer) { res.status(404).json({ success: false, error: 'Customer not found' }); return; }

  const agg = await prisma.order.aggregate({ where: { customerId: customer.id, status: 'completed' }, _sum: { total: true }, _count: { id: true } });

  const timeline: { type: string; label: string; date: string }[] = [
    { type: 'account_created', label: 'Account created', date: customer.createdAt.toISOString() },
    ...customer.addresses.map((a) => ({ type: 'address_added', label: `Address: ${(a as any).label ?? a.addressText}`, date: a.createdAt.toISOString() })),
    ...customer.orders.map((o) => ({ type: 'order', label: `Order #${o.orderNumber} · Rs. ${o.total.toFixed(0)} · ${o.status}`, date: o.createdAt.toISOString() })),
  ];
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({ success: true, data: { id: customer.id, name: customer.name, mobile: customer.mobile, email: customer.email, isBlocked: customer.isBlocked, adminNote: customer.adminNote, tags: (customer as any).tags ?? [], createdAt: customer.createdAt, totalOrders: agg._count.id, totalSpent: Math.round((agg._sum.total ?? 0) * 100) / 100, addresses: customer.addresses, orders: customer.orders, timeline } });
});

adminRouter.patch('/customers/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { adminNote, isBlocked, tags } = req.body;
  const data: any = {};
  if (adminNote !== undefined) data.adminNote = adminNote;
  if (isBlocked !== undefined) data.isBlocked = isBlocked;
  if (tags !== undefined) data.tags = tags;
  res.json({ success: true, data: await prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, name: true, adminNote: true, isBlocked: true, tags: true } }) });
});

adminRouter.get('/customers/:id/export', async (req: AuthenticatedRequest, res: Response) => {
  const orders = await prisma.order.findMany({
    where:   { customerId: req.params.id },
    include: { items: { select: { menuItemName: true, quantity: true, totalPrice: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    date:        o.createdAt.toISOString().slice(0, 10),
    items:       o.items.map((i) => `${i.quantity}x ${i.menuItemName}`).join(' | '),
    subtotal:    o.subtotal.toFixed(2),
    deliveryFee: o.deliveryFee.toFixed(2),
    total:       o.total.toFixed(2),
    status:      o.status,
  }));

  const csv = toCsv(rows, [
    { key: 'orderNumber', header: 'Order #' },
    { key: 'date',        header: 'Date' },
    { key: 'items',       header: 'Items' },
    { key: 'subtotal',    header: 'Subtotal' },
    { key: 'deliveryFee', header: 'Delivery Fee' },
    { key: 'total',       header: 'Total' },
    { key: 'status',      header: 'Status' },
  ]);

  res.set(csvHeaders(`customer-${req.params.id}.csv`));
  res.send(csv);
});

// ─── ORDERS ─────────────────────────────────────────────────────

adminRouter.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  const { status, page = '1', limit = '25', search, offlineSync } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (status) where.status = status;
  if (offlineSync === 'true') where.offlineSync = true;
  if (search) where.OR = [{ orderNumber: { contains: search, mode: 'insensitive' } }, { customer: { name: { contains: search, mode: 'insensitive' } } }];
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, include: { items: true, customer: { select: { id: true, name: true, mobile: true } }, driver: { select: { id: true, username: true } } }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
    prisma.order.count({ where }),
  ]);
  res.json({ success: true, data: { items: orders, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
});

adminRouter.patch('/orders/:id/assign', async (req: AuthenticatedRequest, res: Response) => {
  const { driverId } = req.body;
  if (!driverId) { res.status(400).json({ success: false, error: 'driverId required' }); return; }
  const driver = await prisma.staff.findFirst({ where: { id: driverId, role: 'delivery', isActive: true, verificationStatus: 'VERIFIED' } });
  if (!driver) { res.status(404).json({ success: false, error: 'Driver not found or not verified' }); return; }
  try {
    res.json({ success: true, data: await applyStatusChange(req.params.id, 'assigned', 'admin', { driverId }) });
  } catch (err) {
    if (err instanceof AppError) res.status(err.statusCode).json({ success: false, error: err.message });
    else res.status(500).json({ success: false, error: 'Assignment failed' });
  }
});

adminRouter.patch('/orders/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, data: await applyStatusChange(req.params.id, 'cancelled', 'admin') });
  } catch (err) {
    if (err instanceof AppError) res.status(err.statusCode).json({ success: false, error: err.message });
    else res.status(500).json({ success: false, error: 'Cancellation failed' });
  }
});

// ─── SETTINGS ───────────────────────────────────────────────────

adminRouter.get('/settings', async (_req, res: Response) => {
  let s = await prisma.systemSettings.findFirst();
  if (!s) s = await prisma.systemSettings.create({ data: { deliveryFee: 150, freeDeliveryThreshold: 1500, deliveryRadiusKm: 15, restaurantName: 'CheezyHub', isOpen: true } });
  res.json({ success: true, data: s });
});

adminRouter.patch('/settings', async (req: AuthenticatedRequest, res: Response) => {
  let s = await prisma.systemSettings.findFirst();
  if (!s) s = await prisma.systemSettings.create({ data: { deliveryFee: 150, freeDeliveryThreshold: 1500, deliveryRadiusKm: 15, restaurantName: 'CheezyHub', isOpen: true } });
  const { deliveryFee, freeDeliveryThreshold, deliveryRadiusKm, restaurantName, isOpen, prepTimeMinutes } = req.body;
  const data: any = {};
  if (deliveryFee !== undefined) data.deliveryFee = Number(deliveryFee);
  if (freeDeliveryThreshold !== undefined) data.freeDeliveryThreshold = Number(freeDeliveryThreshold);
  if (deliveryRadiusKm !== undefined) data.deliveryRadiusKm = Number(deliveryRadiusKm);
  if (restaurantName !== undefined) data.restaurantName = restaurantName;
  if (typeof isOpen === 'boolean') data.isOpen = isOpen;
  if (prepTimeMinutes !== undefined) data.prepTimeMinutes = Number(prepTimeMinutes);
  res.json({ success: true, data: await prisma.systemSettings.update({ where: { id: s.id }, data }) });
});

// ─── STATS + ANALYTICS ──────────────────────────────────────────

adminRouter.get('/stats', async (_req, res: Response) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [totalOrders, todayOrders, activeOrders, revenue, openTickets, pendingCount, totalCustomers] = await Promise.all([
    prisma.order.count({ where: { status: { not: 'cancelled' } } }),
    prisma.order.count({ where: { createdAt: { gte: today }, status: { not: 'cancelled' } } }),
    prisma.order.count({ where: { status: { in: ['pending', 'preparing', 'ready', 'assigned', 'picked_up'] } } }),
    prisma.order.aggregate({ where: { status: 'completed' }, _sum: { total: true } }),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }).catch(() => 0),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.user.count({ where: { isBlocked: false } }),
  ]);
  res.json({ success: true, data: { totalOrders, todayOrders, activeOrders, pendingOrders: pendingCount, totalRevenue: revenue._sum.total ?? 0, openTickets, totalCustomers } });
});

adminRouter.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  const range = parseInt((req.query.range as string) || '7');

  const now  = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - (range - 1));
  from.setHours(0, 0, 0, 0);

  // Previous period for comparison
  const prevTo   = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (range - 1));
  prevFrom.setHours(0, 0, 0, 0);

  const [currentOrders, prevOrders, driverStats] = await Promise.all([
    prisma.order.findMany({
      where:   { createdAt: { gte: from } },
      include: { items: { select: { menuItemName: true, quantity: true, totalPrice: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.findMany({
      where:   { createdAt: { gte: prevFrom, lte: prevTo }, status: 'completed' },
      select:  { total: true },
    }),
    prisma.staff.findMany({
      where:  { role: 'delivery' },
      select: {
        id: true, username: true, fullName: true,
        totalDeliveries: true, todayDeliveries: true,
        codPending: true, driverStatus: true, verificationStatus: true,
      },
    }),
  ]);

  const completed  = currentOrders.filter((o) => o.status === 'completed');
  const cancelled  = currentOrders.filter((o) => o.status === 'cancelled');
  const totalRevenue = completed.reduce((s, o) => s + o.total, 0);
  const avgOrderValue = completed.length > 0 ? totalRevenue / completed.length : 0;
  const cancellationRate = currentOrders.length > 0
    ? Math.round((cancelled.length / currentOrders.length) * 1000) / 10
    : 0;

  // Previous period totals for comparison
  const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
  const prevCount   = prevOrders.length;

  const revenueChange = prevRevenue > 0
    ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 1000) / 10
    : null;
  const ordersChange = prevCount > 0
    ? Math.round(((completed.length - prevCount) / prevCount) * 1000) / 10
    : null;

  // ── Daily breakdown ──────────────────────────────────────────
  const dailyMap = new Map<string, { orders: number; revenue: number; cancelled: number }>();
  for (let i = 0; i < range; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    dailyMap.set(d.toISOString().slice(0, 10), { orders: 0, revenue: 0, cancelled: 0 });
  }
  for (const o of currentOrders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const day = dailyMap.get(key);
    if (!day) continue;
    if (o.status === 'completed') { day.orders++; day.revenue += o.total; }
    if (o.status === 'cancelled') day.cancelled++;
  }
  const daily = Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v }));

  // ── Hourly distribution ──────────────────────────────────────
  const hourMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourMap.set(h, 0);
  for (const o of completed) {
    const h = new Date(o.createdAt).getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  const hourly = Array.from(hourMap.entries()).map(([hour, orders]) => ({ hour, orders }));

  // ── Top items ────────────────────────────────────────────────
  const itemAgg = await prisma.orderItem.groupBy({
    by:      ['menuItemName'],
    where:   { order: { createdAt: { gte: from }, status: 'completed' } },
    _sum:    { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take:    8,
  });
  const topItems = itemAgg.map((i) => ({
    name:     i.menuItemName,
    quantity: i._sum.quantity ?? 0,
    revenue:  Math.round((i._sum.totalPrice ?? 0) * 100) / 100,
  }));

  // ── Order type breakdown ─────────────────────────────────────
  const typeMap = new Map<string, { count: number; revenue: number }>();
  for (const o of completed) {
    const t = o.orderType ?? 'delivery';
    const existing = typeMap.get(t) ?? { count: 0, revenue: 0 };
    typeMap.set(t, { count: existing.count + 1, revenue: existing.revenue + o.total });
  }
  const orderTypeBreakdown = Array.from(typeMap.entries()).map(([type, v]) => ({
    type,
    count:   v.count,
    revenue: Math.round(v.revenue * 100) / 100,
  }));

  // ── Payment method breakdown ─────────────────────────────────
  const pmMap = new Map<string, { count: number; revenue: number }>();
  for (const o of completed) {
    const m = o.paymentMethod ?? 'cash';
    const existing = pmMap.get(m) ?? { count: 0, revenue: 0 };
    pmMap.set(m, { count: existing.count + 1, revenue: existing.revenue + o.total });
  }
  const paymentMethodBreakdown = Array.from(pmMap.entries()).map(([method, v]) => ({
    method,
    count:   v.count,
    revenue: Math.round(v.revenue * 100) / 100,
  }));

  // ── Driver performance ───────────────────────────────────────
  const driverPerformance = driverStats.map((d) => ({
    id:               d.id,
    username:         d.username,
    fullName:         d.fullName,
    totalDeliveries:  d.totalDeliveries,
    todayDeliveries:  d.todayDeliveries,
    codPending:       d.codPending,
    status:           d.driverStatus,
    verified:         d.verificationStatus === 'VERIFIED',
  }));

  res.json({
    success: true,
    data: {
      range,
      summary: {
        totalRevenue:     Math.round(totalRevenue * 100) / 100,
        totalOrders:      currentOrders.length,
        completedOrders:  completed.length,
        avgOrderValue:    Math.round(avgOrderValue * 100) / 100,
        cancellationRate,
      },
      comparison: {
        revenue:       Math.round(prevRevenue * 100) / 100,
        orders:        prevCount,
        revenueChange,
        ordersChange,
      },
      daily,
      hourly,
      topItems,
      orderTypeBreakdown,
      paymentMethodBreakdown,
      driverPerformance,
    },
  });
});

// ─── ANALYTICS CSV EXPORT ───────────────────────────────────────
adminRouter.get('/analytics/export', async (req: AuthenticatedRequest, res: Response) => {
  const range = Math.max(1, Math.min(parseInt((req.query.range as string) || '7'), 365));

  const from = new Date();
  from.setDate(from.getDate() - (range - 1));
  from.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where:   { createdAt: { gte: from } },
    select:  { createdAt: true, status: true, total: true },
    orderBy: { createdAt: 'asc' },
  });

  const dailyMap = new Map<string, { orders: number; revenue: number; cancelled: number }>();
  for (let i = 0; i < range; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    dailyMap.set(d.toISOString().slice(0, 10), { orders: 0, revenue: 0, cancelled: 0 });
  }
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const day = dailyMap.get(key);
    if (!day) continue;
    if (o.status === 'completed') { day.orders++; day.revenue += o.total; }
    if (o.status === 'cancelled') day.cancelled++;
  }

  const rows = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    orders:        v.orders,
    revenue:       v.revenue.toFixed(2),
    cancelled:     v.cancelled,
    avgOrderValue: v.orders > 0 ? (v.revenue / v.orders).toFixed(2) : '0.00',
  }));

  const csv = toCsv(rows, [
    { key: 'date',          header: 'Date' },
    { key: 'orders',        header: 'Orders' },
    { key: 'revenue',       header: 'Revenue (Rs.)' },
    { key: 'cancelled',     header: 'Cancelled' },
    { key: 'avgOrderValue', header: 'Avg Order Value (Rs.)' },
  ]);

  res.set(csvHeaders(`analytics-${range}d.csv`));
  res.send(csv);
});


// ─── MENU CRUD ───────────────────────────────────────────────────

adminRouter.get('/menu', async (_req, res: Response) => {
  const cats = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sortOrder: 'asc' }, include: { modifierGroups: { include: { modifiers: { orderBy: { sortOrder: 'asc' } } } } } } } });
  res.json({ success: true, data: cats });
});
adminRouter.post('/menu/categories', async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json({ success: true, data: await prisma.category.create({ data: { name: req.body.name, sortOrder: req.body.sortOrder ?? 0 } }) });
});
adminRouter.patch('/menu/categories/:id', async (req: AuthenticatedRequest, res: Response) => {
  const d: any = {};
  if (req.body.name !== undefined) d.name = req.body.name;
  if (req.body.sortOrder !== undefined) d.sortOrder = req.body.sortOrder;
  res.json({ success: true, data: await prisma.category.update({ where: { id: req.params.id }, data: d }) });
});
adminRouter.delete('/menu/categories/:id', async (req: AuthenticatedRequest, res: Response) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
adminRouter.get('/menu/items/:id', async (req: AuthenticatedRequest, res: Response) => {
  const item = await prisma.menuItem.findUnique({ where: { id: req.params.id }, include: { modifierGroups: { include: { modifiers: true } } } });
  if (!item) { res.status(404).json({ success: false, error: 'Item not found' }); return; }
  res.json({ success: true, data: item });
});
adminRouter.post('/menu/items', async (req: AuthenticatedRequest, res: Response) => {
  const { categoryId, name, description, basePrice, imageUrl, sortOrder, modifierGroups } = req.body;
  const item = await prisma.menuItem.create({
    data: { categoryId, name, description: description || null, basePrice: Number(basePrice), imageUrl: imageUrl || null, sortOrder: sortOrder ?? 0, modifierGroups: modifierGroups ? { create: modifierGroups.map((g: any) => ({ name: g.name, required: g.required ?? false, multiSelect: g.multiSelect ?? false, modifiers: { create: g.modifiers?.map((m: any) => ({ name: m.name, priceAdjustment: Number(m.priceAdjustment ?? 0) })) ?? [] } })) } : undefined },
    include: { modifierGroups: { include: { modifiers: true } } },
  });
  res.status(201).json({ success: true, data: item });
});
adminRouter.patch('/menu/items/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, basePrice, imageUrl, sortOrder, isAvailable } = req.body;
  const d: any = {};
  if (name !== undefined) d.name = name;
  if (description !== undefined) d.description = description;
  if (basePrice !== undefined) d.basePrice = Number(basePrice);
  if (imageUrl !== undefined) d.imageUrl = imageUrl;
  if (sortOrder !== undefined) d.sortOrder = sortOrder;
  if (isAvailable !== undefined) d.isAvailable = isAvailable;
  res.json({ success: true, data: await prisma.menuItem.update({ where: { id: req.params.id }, data: d }) });
});
adminRouter.patch('/menu/items/:id/availability', async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await prisma.menuItem.update({ where: { id: req.params.id }, data: { isAvailable: req.body.isAvailable } }) });
});
adminRouter.patch('/menu/modifiers/:id/availability', async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await prisma.modifier.update({ where: { id: req.params.id }, data: { isAvailable: req.body.isAvailable } }) });
});
adminRouter.delete('/menu/items/:id', async (req: AuthenticatedRequest, res: Response) => {
  await prisma.menuItem.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ─── DEALS ──────────────────────────────────────────────────────

adminRouter.get('/deals', async (_req, res: Response) => {
  res.json({ success: true, data: await prisma.deal.findMany({ orderBy: { createdAt: 'desc' } }) });
});
adminRouter.post('/deals', async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, imageUrl, dealType, discountType, discountValue, linkedItemIds, validFrom, validTo, displayLocation, isActive } = req.body;
  const deal = await prisma.deal.create({ data: { title, description: description || null, imageUrl: imageUrl || null, dealType, discountType, discountValue: Number(discountValue ?? 0), linkedItemIds: linkedItemIds ?? [], validFrom: validFrom ? new Date(validFrom) : new Date(), validTo: validTo ? new Date(validTo) : null, displayLocation: displayLocation ?? 'both', isActive: isActive ?? true } });
  res.status(201).json({ success: true, data: deal });
});
adminRouter.patch('/deals/:id', async (req: AuthenticatedRequest, res: Response) => {
  const d: any = {};
  const keys = ['title', 'description', 'imageUrl', 'dealType', 'discountType', 'discountValue', 'linkedItemIds', 'displayLocation', 'isActive'];
  for (const k of keys) if (req.body[k] !== undefined) d[k] = k === 'discountValue' ? Number(req.body[k]) : req.body[k];
  if (req.body.validFrom !== undefined) d.validFrom = new Date(req.body.validFrom);
  if (req.body.validTo !== undefined) d.validTo = req.body.validTo ? new Date(req.body.validTo) : null;
  res.json({ success: true, data: await prisma.deal.update({ where: { id: req.params.id }, data: d }) });
});
adminRouter.patch('/deals/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  const deal = await prisma.deal.findUnique({ where: { id: req.params.id } });
  if (!deal) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  res.json({ success: true, data: await prisma.deal.update({ where: { id: req.params.id }, data: { isActive: !deal.isActive } }) });
});
adminRouter.delete('/deals/:id', async (req: AuthenticatedRequest, res: Response) => {
  await prisma.deal.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ─── MISC ────────────────────────────────────────────────────────

adminRouter.get('/drivers', async (_req, res: Response) => {
  res.json({ success: true, data: await prisma.staff.findMany({ where: { role: 'delivery', isActive: true }, select: { id: true, username: true, fullName: true }, orderBy: { username: 'asc' } }) });
});
adminRouter.get('/notifications', async (_req, res: Response) => {
  const logs = await prisma.notificationLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []);
  res.json({ success: true, data: logs });
});
adminRouter.get('/dashboard', async (_req, res: Response) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [todayOrders, activeOrders, revenue, blockedCustomers] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count({ where: { status: { in: ['pending', 'preparing', 'ready', 'assigned', 'picked_up'] } } }),
    prisma.order.aggregate({ where: { status: 'completed', createdAt: { gte: today } }, _sum: { total: true } }),
    prisma.user.count({ where: { isBlocked: true } }),
  ]);
  res.json({ success: true, data: { todayOrders, activeOrders, todayRevenue: revenue._sum.total ?? 0, blockedCustomers } });
});
