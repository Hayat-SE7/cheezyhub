'use client';

// ─────────────────────────────────────────────────────────────────
//  DealsSection.tsx  — customer homepage deals carousel
//  DO NOT import from '@prisma/client' in frontend components.
//  Uses a local Deal interface that matches the API response shape.
// ─────────────────────────────────────────────────────────────────

import { motion } from 'framer-motion';
import { Tag, Clock, Star, Zap, Gift, Package, ShoppingCart } from 'lucide-react';

interface LinkedItem {
  id:             string;
  name:           string;
  description?:   string;
  basePrice:      number;
  imageUrl?:      string;
  isAvailable:    boolean;
  modifierGroups: any[];
}

// ── Local Deal interface (mirrors Prisma model fields used here) ──
export interface Deal {
  id:              string;
  title:           string;
  description?:    string | null;
  imageUrl?:       string | null;
  dealType:        string;   // string — API may return any value
  discountType:    string;
  discountValue:   number;
  displayLocation?: string;
  validTo?:        string | Date | null;
  linkedItems?:    LinkedItem[];
}

type KnownDealType = 'combo' | 'discount' | 'promotion' | 'featured';

const DEAL_ICONS: Record<KnownDealType, React.ElementType> = {
  combo:     Package,
  discount:  Tag,
  promotion: Zap,
  featured:  Star,
};

const DEAL_COLORS: Record<KnownDealType, { bg: string; accent: string; text: string; border: string }> = {
  combo:     { bg: '#1a2535', accent: '#3b82f6', text: '#93c5fd', border: '#3b82f6' },
  discount:  { bg: '#2a1515', accent: '#ef4444', text: '#fca5a5', border: '#ef4444' },
  promotion: { bg: '#1f1535', accent: '#8b5cf6', text: '#c4b5fd', border: '#8b5cf6' },
  featured:  { bg: '#2d1e0f', accent: '#f59e0b', text: '#fcd34d', border: '#f59e0b' },
};

const EMOJI_BG: Record<string, string> = {
  combo:     '🍔+🍟+🥤',
  discount:  '🔥',
  promotion: '✨',
  featured:  '⭐',
};

const FALLBACK_COLOR = DEAL_COLORS.featured;

interface DealsSectionProps {
  deals: Deal[];
  onSelectDeal?: (deal: Deal) => void;
}

export default function DealsSection({ deals, onSelectDeal }: DealsSectionProps) {
  if (!deals || deals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-amber-500" />
          <h2 className="font-display font-bold text-[#f5d38e] text-base">Deals & Offers</h2>
        </div>
        <span className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
          {deals.length} active
        </span>
      </div>

      {/* Horizontal scroll container */}
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scroll-smooth"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {deals.map((deal, i) => {
          const type   = deal.dealType as KnownDealType;
          const colors = DEAL_COLORS[type] ?? FALLBACK_COLOR;
          const Icon   = DEAL_ICONS[type]  ?? Tag;

          const discountLabel =
            deal.discountValue > 0
              ? deal.discountType === 'percent'
                ? `${deal.discountValue}% OFF`
                : `Save Rs. ${deal.discountValue.toFixed(0)}`
              : null;

          const validToDate = deal.validTo ? new Date(deal.validTo) : null;
          const timeLeft = validToDate
            ? Math.ceil((validToDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => onSelectDeal?.(deal)}
              className="flex-shrink-0 w-52 rounded-2xl overflow-hidden border-l-4 border border-transparent shadow-sm cursor-pointer hover:scale-[1.02] transition-transform"
              style={{ background: colors.bg, borderLeftColor: colors.accent, borderColor: `${colors.accent}30` }}
            >
              {/* Image / Emoji header */}
              <div
                className="h-24 relative flex items-center justify-center overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${colors.accent}20, ${colors.accent}40)` }}
              >
                {deal.imageUrl ? (
                  <img
                    src={deal.imageUrl}
                    alt={deal.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl select-none">{EMOJI_BG[deal.dealType] ?? '🍽'}</span>
                )}

                {/* Discount badge */}
                {discountLabel && (
                  <div
                    className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                    style={{ background: colors.accent }}
                  >
                    {discountLabel}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} style={{ color: colors.accent }} />
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: colors.text }}
                  >
                    {deal.dealType}
                  </span>
                </div>
                <h3 className="font-display font-bold text-white text-sm leading-tight line-clamp-2">
                  {deal.title}
                </h3>
                {deal.description && (
                  <p className="text-[11px] text-[#a07850] mt-1 line-clamp-1">{deal.description}</p>
                )}

                {timeLeft !== null && timeLeft <= 3 && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-red-500 font-semibold">
                    <Clock size={9} />
                    {timeLeft <= 0 ? 'Ends today!' : `${timeLeft}d left`}
                  </div>
                )}

                {deal.linkedItems && deal.linkedItems.length > 0 && (
                  <div
                    className="mt-2.5 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold text-white transition-colors"
                    style={{ background: colors.accent }}
                  >
                    <ShoppingCart size={10} />
                    Order Now
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
