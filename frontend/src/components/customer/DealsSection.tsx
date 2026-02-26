'use client';
import { Deal } from '@prisma/client';
import { motion } from 'framer-motion';
import { Tag, Clock, Star, Zap, Gift, Package } from 'lucide-react';

const DEAL_ICONS = {
  combo:       Package,
  discount:    Tag,
  promotion:   Zap,
  featured:    Star,
};

const DEAL_COLORS = {
  combo:       { bg: '#eff6ff', accent: '#3b82f6', text: '#1d4ed8', border: '#bfdbfe' },
  discount:    { bg: '#fef2f2', accent: '#ef4444', text: '#dc2626', border: '#fecaca' },
  promotion:   { bg: '#faf5ff', accent: '#8b5cf6', text: '#7c3aed', border: '#ddd6fe' },
  featured:    { bg: '#fffbeb', accent: '#f59e0b', text: '#d97706', border: '#fde68a' },
};

const EMOJI_BG: Record<string, string> = {
  combo: '🍔+🍟+🥤',
  discount: '🔥',
  promotion: '✨',
  featured: '⭐',
};

interface DealsSectionProps {
  deals: Deal[];
}

export const DealsSection = ({ deals }: DealsSectionProps) => {
  if (deals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-amber-500" />
          <h2 className="font-display font-bold text-[#1c1714] text-base">Deals & Offers</h2>
        </div>
        <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
          {deals.length} active
        </span>
      </div>

      {/* Horizontal scroll container */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {deals.map((deal, i) => {
          const colors = DEAL_COLORS[deal.dealType] ?? DEAL_COLORS.featured;
          const Icon = DEAL_ICONS[deal.dealType] ?? Tag;
          const discountLabel =
            deal.discountValue > 0
              ? deal.discountType === 'percent'
                ? `${deal.discountValue}% OFF`
                : `Save $${deal.discountValue.toFixed(2)}`
              : null;

          const timeLeft = deal.validTo
            ? Math.ceil((new Date(deal.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex-shrink-0 w-52 rounded-2xl overflow-hidden border shadow-sm"
              style={{ background: colors.bg, borderColor: colors.border }}
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
                  <span className="text-4xl select-none">{EMOJI_BG[deal.dealType]}</span>
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
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.text }}>
                    {deal.dealType}
                  </span>
                </div>
                <h3 className="font-display font-bold text-[#1c1714] text-sm leading-tight line-clamp-2">
                  {deal.title}
                </h3>
                {deal.description && (
                  <p className="text-[11px] text-[#a39083] mt-1 line-clamp-1">{deal.description}</p>
                )}

                {timeLeft !== null && timeLeft <= 3 && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-red-500 font-semibold">
                    <Clock size={9} />
                    {timeLeft === 0 ? 'Ends today!' : `${timeLeft}d left`}
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
