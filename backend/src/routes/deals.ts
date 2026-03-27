// ─────────────────────────────────────────────────────
//  DEALS ROUTE
//  Public: GET active deals (for customer hero slider + deals section)
//  Admin: Full CRUD for deal management
// ─────────────────────────────────────────────────────

import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

export const dealsRouter = Router();

// ─── PUBLIC: GET /api/deals ───────────────────────────
// Returns active deals within validity window
// Used by: customer hero slider + deals section

dealsRouter.get('/', async (_req: Request, res: Response) => {
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: {
      isActive: true,
      validFrom: { lte: now },
      OR: [
        { validTo: null },
        { validTo: { gte: now } },
      ],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ success: true, data: deals });
});

// ─── PUBLIC: GET /api/deals/slider ────────────────────
// Only slider deals (for hero component)

dealsRouter.get('/slider', async (_req: Request, res: Response) => {
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: {
      isActive: true,
      displayLocation: { in: ['slider', 'both'] },
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: [{ sortOrder: 'asc' }],
  });
  res.json({ success: true, data: deals });
});

// ─── ADMIN ROUTES ────────────────────────────────────
// All below require admin authentication

dealsRouter.use('/admin', authenticate, requireRole('admin'));

// GET /api/deals/admin — all deals (including inactive)
dealsRouter.get('/admin', async (_req: AuthenticatedRequest, res: Response) => {
  const deals = await prisma.deal.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ success: true, data: deals });
});

// POST /api/deals/admin — create deal
const dealSchema = z.object({
  title:           z.string().min(1).max(100),
  description:     z.string().max(300).optional(),
  imageUrl:        z.string().url().optional().or(z.literal('')),
  dealType:        z.enum(['combo', 'discount', 'promotion', 'featured']).default('featured'),
  discountType:    z.enum(['flat', 'percent']).default('flat'),
  discountValue:   z.number().min(0).default(0),
  linkedItemIds:   z.array(z.string()).default([]),
  validFrom:       z.string().datetime().optional(),
  validTo:         z.string().datetime().optional().nullable(),
  displayLocation: z.enum(['slider', 'deals_section', 'both']).default('both'),
  isActive:        z.boolean().default(true),
  sortOrder:       z.number().int().default(0),
});

dealsRouter.post('/admin', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = dealSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
    return;
  }
  const deal = await prisma.deal.create({
    data: {
      ...parsed.data,
      imageUrl:      parsed.data.imageUrl || null,
      validFrom:     parsed.data.validFrom ? new Date(parsed.data.validFrom) : new Date(),
      validTo:       parsed.data.validTo   ? new Date(parsed.data.validTo)   : null,
      linkedItemIds: parsed.data.linkedItemIds as any,
    },
  });
  res.status(201).json({ success: true, data: deal });
});

// PATCH /api/deals/admin/:id — update deal
dealsRouter.patch('/admin/:id', async (req: AuthenticatedRequest, res: Response) => {
  const partial = dealSchema.partial().safeParse(req.body);
  if (!partial.success) {
    res.status(400).json({ success: false, error: partial.error.errors[0]?.message });
    return;
  }
  const data: any = { ...partial.data };
  if (data.validFrom) data.validFrom = new Date(data.validFrom);
  if (data.validTo)   data.validTo   = new Date(data.validTo);
  if (data.imageUrl === '') data.imageUrl = null;

  const deal = await prisma.deal.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: deal });
});

// DELETE /api/deals/admin/:id
dealsRouter.delete('/admin/:id', async (req: AuthenticatedRequest, res: Response) => {
  await prisma.deal.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Deal deleted' });
});

// PATCH /api/deals/admin/:id/toggle — quick active toggle
dealsRouter.patch('/admin/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  const deal = await prisma.deal.findUnique({ where: { id: req.params.id } });
  if (!deal) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  const updated = await prisma.deal.update({
    where: { id: req.params.id },
    data: { isActive: !deal.isActive },
  });
  res.json({ success: true, data: updated });
});
