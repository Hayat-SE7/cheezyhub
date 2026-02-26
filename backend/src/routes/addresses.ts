// ─────────────────────────────────────────────────────
//  ADDRESSES ROUTE  — Customer only
//  GPS + manual address CRUD
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

export const addressRouter = Router();

// All address routes require a logged-in customer
// (Admin Staff JWTs use Staff IDs — they should not use this route)
addressRouter.use(authenticate, requireRole('customer'));

// ─── Schema ──────────────────────────────────────────
const addressSchema = z.object({
  label:       z.string().min(1).max(50).default('Home'),
  type:        z.enum(['home', 'work', 'other']).default('home'),
  addressText: z.string().min(3).max(500),
  houseNo:     z.string().max(50).optional(),
  street:      z.string().max(100).optional(),
  area:        z.string().max(100).optional(),
  city:        z.string().max(100).optional(),
  notes:       z.string().max(300).optional(),
  latitude:    z.number().optional(),
  longitude:   z.number().optional(),
  isGps:       z.boolean().default(false),
  isDefault:   z.boolean().default(false),
});

// ─── GET /api/addresses ───────────────────────────────
addressRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const addresses = await prisma.addresses.findMany({
    where:   { userId: req.user!.userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  res.json({ success: true, data: addresses });
});

// ─── POST /api/addresses/save-gps ────────────────────
// Static path MUST be before /:id dynamic routes
addressRouter.post('/save-gps', async (req: AuthenticatedRequest, res: Response) => {
  const { latitude, longitude, addressText } = req.body;
  if (!latitude || !longitude || !addressText) {
    res.status(400).json({ success: false, error: 'latitude, longitude and addressText are required' });
    return;
  }

  const userId = req.user!.userId;

  // Unset old defaults
  await prisma.addresses.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });

  // Create GPS address
  const address = await prisma.addresses.create({
    data: {
      userId,
      label:       'Current Location',
      type:        'home',
      addressText,
      latitude,
      longitude,
      isGps:      true,
      isDefault:  true,
    },
  });

  // Update user live location fields
  await prisma.user.update({
    where: { id: userId },
    data:  {
      liveLat:            latitude,
      liveLng:            longitude,
      liveAddress:        addressText,
      isLocationVerified: true,
      defaultAddressId:   address.id,
    },
  });

  res.json({ success: true, data: address });
});

// ─── POST /api/addresses ─────────────────────────────
addressRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const userId = req.user!.userId;
  const data   = parsed.data;

  // First-ever address is always default
  const count = await prisma.addresses.count({ where: { userId } });
  if (count === 0) data.isDefault = true;

  // If marking as default, unset existing default first
  if (data.isDefault) {
    await prisma.addresses.updateMany({
      where: { userId, isDefault: true },
      data:  { isDefault: false },
    });
  }

  const address = await prisma.addresses.create({ data: { ...data, userId } });

  // Sync user profile fields when GPS address
  if (data.isGps && data.latitude && data.longitude) {
    await prisma.user.update({
      where: { id: userId },
      data:  {
        liveLat:            data.latitude,
        liveLng:            data.longitude,
        liveAddress:        data.addressText,
        isLocationVerified: true,
        defaultAddressId:   address.id,
      },
    });
  } else if (data.isDefault) {
    await prisma.user.update({
      where: { id: userId },
      data:  { defaultAddressId: address.id },
    });
  }

  res.status(201).json({ success: true, data: address });
});

// ─── PATCH /api/addresses/:id/set-default ────────────
// Static suffix path BEFORE generic /:id
addressRouter.patch('/:id/set-default', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const existing = await prisma.addresses.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Address not found' });
    return;
  }

  await prisma.addresses.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  await prisma.addresses.update({ where: { id: req.params.id }, data: { isDefault: true } });
  await prisma.user.update({ where: { id: userId }, data: { defaultAddressId: req.params.id } });

  res.json({ success: true, message: 'Default address updated' });
});

// ─── PATCH /api/addresses/:id ────────────────────────
addressRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const existing = await prisma.addresses.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Address not found' });
    return;
  }

  const parsed = addressSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }

  const data = parsed.data;

  if (data.isDefault) {
    await prisma.addresses.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    await prisma.user.update({ where: { id: userId }, data: { defaultAddressId: req.params.id } });
  }

  const address = await prisma.addresses.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: address });
});

// ─── DELETE /api/addresses/:id ────────────────────────
addressRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const existing = await prisma.addresses.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Address not found' });
    return;
  }

  await prisma.addresses.delete({ where: { id: req.params.id } });

  // Promote the next oldest address to default if the deleted one was default
  if (existing.isDefault) {
    const next = await prisma.addresses.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await prisma.addresses.update({ where: { id: next.id }, data: { isDefault: true } });
      await prisma.user.update({ where: { id: userId }, data: { defaultAddressId: next.id } });
    } else {
      await prisma.user.update({ where: { id: userId }, data: { defaultAddressId: null } });
    }
  }

  res.json({ success: true, message: 'Address deleted' });
});
