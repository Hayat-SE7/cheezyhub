// ─────────────────────────────────────────────────────
//  FAVOURITES ROUTE  (Phase 9)
//  Customer can heart-save menu items.
//
//  GET  /api/favourites          → list customer's favourited items
//  POST /api/favourites          → toggle { menuItemId } (add/remove)
// ─────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';

export const favouritesRouter = Router();

favouritesRouter.use(authenticate);

// ─── GET /api/favourites ──────────────────────────────
// Returns full menu item details so the UI can render the favourites section

favouritesRouter.get(
  '/',
  requireRole('customer'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const favourites = await prisma.favourite.findMany({
        where:   { userId: req.user!.userId },
        include: {
          menuItem: {
            include: {
              category:       true,
              modifierGroups: { include: { modifiers: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Return just the menu items (with a favouriteId for removal)
      const data = favourites.map((f) => ({
        favouriteId: f.id,
        ...f.menuItem,
      }));

      res.json({ success: true, data });
    } catch (err) {
      console.error('[Favourites] GET error:', err);
      res.status(500).json({ success: false, error: 'Failed to load favourites' });
    }
  }
);

// ─── POST /api/favourites ─────────────────────────────
// Toggle: adds if not present, removes if already favourited

const toggleSchema = z.object({
  menuItemId: z.string().min(1, 'menuItemId is required'),
});

favouritesRouter.post(
  '/',
  requireRole('customer'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = toggleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0]?.message });
      return;
    }

    const { menuItemId } = parsed.data;
    const userId         = req.user!.userId;

    try {
      const existing = await prisma.favourite.findUnique({
        where: { userId_menuItemId: { userId, menuItemId } },
      });

      if (existing) {
        // Already favourited — remove it
        await prisma.favourite.delete({ where: { id: existing.id } });
        res.json({ success: true, data: { favourited: false, menuItemId } });
      } else {
        // Not yet favourited — add it
        await prisma.favourite.create({ data: { userId, menuItemId } });
        res.json({ success: true, data: { favourited: true, menuItemId } });
      }
    } catch (err) {
      console.error('[Favourites] POST error:', err);
      res.status(500).json({ success: false, error: 'Failed to update favourite' });
    }
  }
);
