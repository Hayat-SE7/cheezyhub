// ─────────────────────────────────────────────────────
//  ADDRESSES ROUTE  — Customer only
//  GPS + manual address CRUD
//
//  NOTE: Prisma model is named `Address` (singular) so
//  the client accessor is prisma.address (NOT prisma.addresses)
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

export const addressRouter = Router();

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
  const addresses = await prisma.address.findMany({
    where:   { userId: req.user!.userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  res.json({ success: true, data: addresses });
});

// ─── POST /api/addresses/gps ─────────────────────────
// Static path MUST be before /:id dynamic routes
// Frontend calls: addressApi.saveGps({ latitude, longitude, addressText })
addressRouter.post('/gps', async (req: AuthenticatedRequest, res: Response) => {
  const schema = z.object({
    latitude:    z.number(),
    longitude:   z.number(),
    addressText: z.string().min(3),
    label:       z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'latitude, longitude and addressText are required' });
    return;
  }

  const { latitude, longitude, addressText, label } = parsed.data;
  const userId = req.user!.userId;

  // Unset old defaults
  await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });

  const address = await prisma.address.create({
    data: {
      userId,
      label:       label ?? 'Current Location',
      type:        'home',
      addressText,
      latitude,
      longitude,
      isGps:     true,
      isDefault: true,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data:  {
      liveLat:            latitude,
      liveLng:            longitude,
      liveAddress:        addressText,
      isLocationVerified: true,
      defaultAddressId:   address.id,
    },
    select: { id: true }, // Avoid returning tags
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

  const count = await prisma.address.count({ where: { userId } });
  if (count === 0) data.isDefault = true;

  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }

  const address = await prisma.address.create({ data: { ...data, userId } });

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
      select: { id: true },
    });
  } else if (data.isDefault) {
    await prisma.user.update({ 
      where: { id: userId }, 
      data: { defaultAddressId: address.id },
      select: { id: true }
    });
  }

  res.status(201).json({ success: true, data: address });
});

// ─── PATCH /api/addresses/:id/default ────────────────
addressRouter.patch('/:id/default', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Address not found' });
    return;
  }

  await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  await prisma.address.update({ where: { id: req.params.id }, data: { isDefault: true } });
  await prisma.user.update({ 
    where: { id: userId }, 
    data: { defaultAddressId: req.params.id },
    select: { id: true }
  });

  res.json({ success: true, message: 'Default address updated' });
});

// ─── PATCH /api/addresses/:id ────────────────────────
addressRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId   = req.user!.userId;
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } });
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
    await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    await prisma.user.update({ 
      where: { id: userId }, 
      data: { defaultAddressId: req.params.id },
      select: { id: true }
    });
  }

  const address = await prisma.address.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: address });
});

// ─── DELETE /api/addresses/:id ────────────────────────
addressRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId   = req.user!.userId;
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Address not found' });
    return;
  }

  await prisma.address.delete({ where: { id: req.params.id } });

  if (existing.isDefault) {
    const next = await prisma.address.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      await prisma.user.update({ 
        where: { id: userId }, 
        data: { defaultAddressId: next.id },
        select: { id: true }
      });
    } else {
      await prisma.user.update({ 
        where: { id: userId }, 
        data: { defaultAddressId: null },
        select: { id: true }
      });
    }
  }

  res.json({ success: true, message: 'Address deleted' });
});
