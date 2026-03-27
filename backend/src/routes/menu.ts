// ─────────────────────────────────────────────────────
//  MENU ROUTE — Full CRUD
//  Public:    GET /api/menu (available items only)
//  Admin:     Full CRUD for categories + items + modifier groups
//  Kitchen:   Availability toggles
// ─────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

export const menuRouter = Router();

// ═══════════════════════════════════════════════════════
//  PUBLIC ROUTES
// ═══════════════════════════════════════════════════════

// GET /api/menu — full public menu, available items only
menuRouter.get('/', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          modifierGroups: {
            orderBy: { sortOrder: 'asc' },
            include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
    },
  });
  res.json({ success: true, data: categories });
});

// ═══════════════════════════════════════════════════════
//  ADMIN / KITCHEN — Full view (includes unavailable)
// ═══════════════════════════════════════════════════════

menuRouter.get(
  '/all',
  authenticate,
  requireRole('admin', 'kitchen'),
  async (_req: Request, res: Response) => {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroups: {
              orderBy: { sortOrder: 'asc' },
              include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    res.json({ success: true, data: categories });
  }
);

// ═══════════════════════════════════════════════════════
//  CATEGORIES — Admin CRUD
// ═══════════════════════════════════════════════════════

// GET /api/menu/categories — list all categories
menuRouter.get(
  '/categories',
  authenticate,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    const cats = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { items: true } } },
    });
    res.json({ success: true, data: cats });
  }
);

// POST /api/menu/categories — create category
menuRouter.post(
  '/categories',
  authenticate,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { name, sortOrder = 0 } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Category name required' });
      return;
    }
    try {
      const cat = await prisma.category.create({
        data: { name: name.trim(), sortOrder },
      });
      res.status(201).json({ success: true, data: cat });
    } catch (err: any) {
      if (err.code === 'P2002') {
        res.status(409).json({ success: false, error: 'Category name already exists' });
      } else {
        throw err;
      }
    }
  }
);

// PATCH /api/menu/categories/:id — rename / reorder
menuRouter.patch(
  '/categories/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { name, sortOrder } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    const cat = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: cat });
  }
);

// DELETE /api/menu/categories/:id — delete (only if no items)
menuRouter.delete(
  '/categories/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const count = await prisma.menuItem.count({ where: { categoryId: req.params.id } });
    if (count > 0) {
      res.status(409).json({
        success: false,
        error: `Cannot delete — category has ${count} item${count !== 1 ? 's' : ''}. Move or delete items first.`,
      });
      return;
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Category deleted' });
  }
);

// ═══════════════════════════════════════════════════════
//  MENU ITEMS — Admin CRUD
// ═══════════════════════════════════════════════════════

// Zod schema for item creation / update
const modifierSchema = z.object({
  id:               z.string().optional(), // existing modifier id (for update)
  name:             z.string().min(1),
  priceAdjustment:  z.number().default(0),
  isAvailable:      z.boolean().default(true),
  sortOrder:        z.number().int().default(0),
});

const modifierGroupSchema = z.object({
  id:          z.string().optional(), // existing group id (for update)
  name:        z.string().min(1),
  required:    z.boolean().default(false),
  multiSelect: z.boolean().default(false),
  sortOrder:   z.number().int().default(0),
  modifiers:   z.array(modifierSchema).default([]),
});

const itemSchema = z.object({
  name:           z.string().min(1, 'Name required'),
  description:    z.string().max(500).optional(),
  basePrice:      z.number().min(0, 'Price must be ≥ 0'),
  imageUrl:       z.string().optional().nullable(),
  categoryId:     z.string().min(1, 'Category required'),
  isAvailable:    z.boolean().default(true),
  sortOrder:      z.number().int().default(0),
  modifierGroups: z.array(modifierGroupSchema).default([]),
});

// GET /api/menu/items/:id — full item with modifier groups
menuRouter.get(
  '/items/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const item = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
      include: {
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!item) { res.status(404).json({ success: false, error: 'Item not found' }); return; }
    res.json({ success: true, data: item });
  }
);

// POST /api/menu/items — create item with modifier groups
menuRouter.post(
  '/items',
  authenticate,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }

    const { modifierGroups, ...itemData } = parsed.data;

    const item = await prisma.menuItem.create({
      data: {
        ...itemData,
        imageUrl: itemData.imageUrl || null,
        modifierGroups: {
          create: modifierGroups.map((g, gi) => ({
            name:        g.name,
            required:    g.required,
            multiSelect: g.multiSelect,
            sortOrder:   g.sortOrder ?? gi,
            modifiers: {
              create: g.modifiers.map((m, mi) => ({
                name:            m.name,
                priceAdjustment: m.priceAdjustment,
                isAvailable:     m.isAvailable,
                sortOrder:       m.sortOrder ?? mi,
              })),
            },
          })),
        },
      },
      include: {
        modifierGroups: {
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    res.status(201).json({ success: true, data: item });
  }
);

// PATCH /api/menu/items/:id — update item, fully replace modifier groups
menuRouter.patch(
  '/items/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Partial schema for update (everything optional)
    const updateSchema = itemSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }

    const { modifierGroups, ...itemData } = parsed.data;

    // If modifierGroups provided: delete all existing, recreate
    if (modifierGroups !== undefined) {
      await prisma.modifierGroup.deleteMany({ where: { menuItemId: id } });
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...itemData,
        imageUrl: itemData.imageUrl === '' ? null : itemData.imageUrl,
        ...(modifierGroups !== undefined && {
          modifierGroups: {
            create: modifierGroups.map((g, gi) => ({
              name:        g.name,
              required:    g.required ?? false,
              multiSelect: g.multiSelect ?? false,
              sortOrder:   gi,
              modifiers: {
                create: (g.modifiers ?? []).map((m, mi) => ({
                  name:            m.name,
                  priceAdjustment: m.priceAdjustment ?? 0,
                  isAvailable:     m.isAvailable ?? true,
                  sortOrder:       mi,
                })),
              },
            })),
          },
        }),
      },
      include: {
        modifierGroups: {
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    res.json({ success: true, data: item });
  }
);

// DELETE /api/menu/items/:id
menuRouter.delete(
  '/items/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    await prisma.menuItem.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Item deleted' });
  }
);

// ═══════════════════════════════════════════════════════
//  AVAILABILITY TOGGLES — Kitchen + Admin
// ═══════════════════════════════════════════════════════

menuRouter.patch(
  '/items/:id/availability',
  authenticate,
  requireRole('kitchen', 'admin'),
  async (req: Request, res: Response) => {
    const { isAvailable } = req.body;
    const item = await prisma.menuItem.update({
      where: { id: req.params.id },
      data:  { isAvailable },
    });
    res.json({ success: true, data: item });
  }
);

menuRouter.patch(
  '/modifiers/:id/availability',
  authenticate,
  requireRole('kitchen', 'admin'),
  async (req: Request, res: Response) => {
    const { isAvailable } = req.body;
    const modifier = await prisma.modifier.update({
      where: { id: req.params.id },
      data:  { isAvailable },
    });
    res.json({ success: true, data: modifier });
  }
);
