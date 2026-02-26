// ─────────────────────────────────────────────────────
//  MENU ROUTE
//  v6: ModifierGroups are now STANDALONE (reusable).
//  Items link to groups via MenuItemModifier junction table.
//  All existing endpoints unchanged — new ones added.
// ─────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

export const menuRouter = Router();

// ─── Shared include for item reads ───────────────────
// FIX: In your schema, modifierGroups is a direct relation, not a junction table.
const ITEM_INCLUDE = {
  modifierGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: { 
      modifiers: { orderBy: { sortOrder: 'asc' as const } } 
    },
  },
};

// ─── Flattening Helper ──────────────────────────────
// FIX: Since there is no junction table, mim IS the modifierGroup.
function flattenItem(item: any) {
  return {
    ...item,
    modifierGroups: (item.modifierGroups ?? [])
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
      .map((group: any) => ({
        ...group,
        modifiers: (group.modifiers ?? []).sort(
          (a: any, b: any) => a.sortOrder - b.sortOrder
        ),
      })),
  };
}

// ═══════════════════════════════════════════════════════
//  PUBLIC / ADMIN READS
// ═══════════════════════════════════════════════════════

menuRouter.get('/', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { sortOrder: 'asc' },
        include: ITEM_INCLUDE,
      },
    },
  });
  // FIX: Access .items safely
  res.json({ success: true, data: categories.map(cat => ({ ...cat, items: (cat.items || []).map(flattenItem) })) });
});
// ═══════════════════════════════════════════════════════
//  ADMIN / KITCHEN — Full view
// ═══════════════════════════════════════════════════════

menuRouter.get('/all', authenticate, requireRole('admin', 'kitchen'), async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: ITEM_INCLUDE,
      },
    },
  });
  res.json({ success: true, data: categories.map(cat => ({ ...cat, items: cat.items.map(flattenItem) })) });
});

// ═══════════════════════════════════════════════════════
//  CATEGORIES — Admin CRUD (unchanged)
// ═══════════════════════════════════════════════════════

menuRouter.get('/categories', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  const cats = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { items: true } } },
  });
  res.json({ success: true, data: cats });
});

menuRouter.post('/categories', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const { name, sortOrder = 0 } = req.body;
  if (!name?.trim()) { res.status(400).json({ success: false, error: 'Category name required' }); return; }
  try {
    const cat = await prisma.category.create({ data: { name: name.trim(), sortOrder } });
    res.status(201).json({ success: true, data: cat });
  } catch (err: any) {
    if (err.code === 'P2002') res.status(409).json({ success: false, error: 'Category name already exists' });
    else throw err;
  }
});

menuRouter.patch('/categories/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, sortOrder } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name.trim();
  if (sortOrder !== undefined) data.sortOrder = sortOrder;
  const cat = await prisma.category.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: cat });
});

menuRouter.delete('/categories/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const count = await prisma.menuItem.count({ where: { categoryId: req.params.id } });
  if (count > 0) {
    res.status(409).json({ success: false, error: `Cannot delete — category has ${count} item${count !== 1 ? 's' : ''}. Move or delete items first.` });
    return;
  }
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Category deleted' });
});

// ═══════════════════════════════════════════════════════
//  STANDALONE MODIFIER GROUPS — NEW Admin CRUD
// ═══════════════════════════════════════════════════════

const modifierSchema = z.object({
  name:            z.string().min(1),
  priceAdjustment: z.number().default(0),
  isAvailable:     z.boolean().default(true),
  sortOrder:       z.number().int().default(0),
});

const groupSchema = z.object({
  name:        z.string().min(1, 'Group name required'),
  required:    z.boolean().default(false),
  multiSelect: z.boolean().default(false),
  sortOrder:   z.number().int().default(0),
  modifiers:   z.array(modifierSchema).default([]),
});

// ═══════════════════════════════════════════════════════
//  STANDALONE MODIFIER GROUPS — Fixed for Schema v6.1
// ═══════════════════════════════════════════════════════

// GET /api/menu/modifier-groups
menuRouter.get('/modifier-groups', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  const groups = await prisma.modifierGroup.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      modifiers: { orderBy: { sortOrder: 'asc' } },
      // FIX: Relation in schema is 'menuItem' (singular), not 'menuItems'
      _count: { select: { modifiers: true } }, 
    },
  });
  res.json({ success: true, data: groups });
});

// POST /api/menu/modifier-groups
menuRouter.post('/modifier-groups', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) { 
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message }); 
    return; 
  }
  
  const { modifiers, ...groupData } = parsed.data;
  const { menuItemId } = req.body; // Expecting the parent ID in the body

  if (!menuItemId) {
    res.status(400).json({ success: false, error: 'menuItemId is required by schema' });
    return;
  }

  const group = await prisma.modifierGroup.create({
    data: {
      ...groupData,
      // FIX: The schema requires a MenuItem connection for every ModifierGroup
      menuItem: { connect: { id: menuItemId } },
      modifiers: {
        create: modifiers.map((m, i) => ({ 
          name: m.name, 
          priceAdjustment: m.priceAdjustment, 
          isAvailable: m.isAvailable, 
          sortOrder: m.sortOrder ?? i 
        })),
      },
    },
    include: { 
      modifiers: { orderBy: { sortOrder: 'asc' } }
    },
  });
  res.status(201).json({ success: true, data: group });
});

// PATCH /api/menu/modifier-groups/:id
menuRouter.patch('/modifier-groups/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = groupSchema.partial().safeParse(req.body);
  if (!parsed.success) { 
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message }); 
    return; 
  }
  
  const { modifiers, ...groupData } = parsed.data;

  if (modifiers !== undefined) {
    await prisma.modifier.deleteMany({ where: { modifierGroupId: id } });
  }

  const group = await prisma.modifierGroup.update({
    where: { id },
    data: {
      ...groupData,
      ...(modifiers !== undefined && {
        modifiers: {
          create: modifiers.map((m, i) => ({ 
            name: m.name, 
            priceAdjustment: m.priceAdjustment ?? 0, 
            isAvailable: m.isAvailable ?? true, 
            sortOrder: i 
          })),
        },
      }),
    },
    include: { 
      modifiers: { orderBy: { sortOrder: 'asc' } }
    },
  });
  res.json({ success: true, data: group });
});

// ═══════════════════════════════════════════════════════
//  MENU ITEMS — Admin CRUD (Fixed for Schema v6.1)
// ═══════════════════════════════════════════════════════
// ─── Menu Item Validation Schema ─────────────────────
const itemSchema = z.object({
  name:             z.string().min(1, 'Name required'),
  description:      z.string().max(500).optional(),
  basePrice:        z.number().min(0, 'Price must be ≥ 0'),
  imageUrl:         z.string().optional().nullable(),
  categoryId:       z.string().min(1, 'Category required'),
  isAvailable:      z.boolean().default(true),
  sortOrder:        z.number().int().default(0),
  // Note: modifierGroupIds is accepted for logic but handled 
  // according to your 1-to-many schema [cite: 13, 14]
  modifierGroupIds: z.array(z.string()).optional(),
});
// POST /api/menu/items
menuRouter.post('/items', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) { 
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message }); 
    return; 
  }

  // modifierGroupIds is ignored here because your schema 
  // requires groups to be created as children of an item, not linked by ID.
  const { modifierGroupIds, ...itemData } = parsed.data;

  const item = await prisma.menuItem.create({
    data: {
      ...itemData,
      imageUrl: itemData.imageUrl || null,
      // modifierGroups are created separately via /api/menu/modifier-groups 
      // because they require a name and other fields in your schema.
    },
    include: ITEM_INCLUDE,
  });
  res.status(201).json({ success: true, data: flattenItem(item) });
});

// PATCH /api/menu/items/:id
menuRouter.patch('/items/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) { 
    res.status(400).json({ success: false, error: parsed.error.errors[0]?.message }); 
    return; 
  }

  // FIX: Destructure categoryId to handle it separately if Prisma's unchecked types are strict
  const { modifierGroupIds, categoryId, ...itemData } = parsed.data;

  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      ...itemData,
      imageUrl: itemData.imageUrl === '' ? null : itemData.imageUrl,
      // FIX: If categoryId is provided, connect it via relation
      ...(categoryId && { category: { connect: { id: categoryId } } }),
    },
    include: ITEM_INCLUDE,
  });
  res.json({ success: true, data: flattenItem(item) });
});

// ═══════════════════════════════════════════════════════
//  AVAILABILITY TOGGLES — Kitchen + Admin (unchanged)
// ═══════════════════════════════════════════════════════

menuRouter.patch('/items/:id/availability', authenticate, requireRole('kitchen', 'admin'), async (req: Request, res: Response) => {
  const { isAvailable } = req.body;
  const item = await prisma.menuItem.update({ where: { id: req.params.id }, data: { isAvailable } });
  res.json({ success: true, data: item });
});

menuRouter.patch('/modifiers/:id/availability', authenticate, requireRole('kitchen', 'admin'), async (req: Request, res: Response) => {
  const { isAvailable } = req.body;
  const modifier = await prisma.modifier.update({ where: { id: req.params.id }, data: { isAvailable } });
  res.json({ success: true, data: modifier });
});
