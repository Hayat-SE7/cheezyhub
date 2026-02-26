'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Tag, Clock } from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  dealType: string;
  discountType: string;
  discountValue: number;
  validTo?: string;
}

interface HeroSliderProps {
  deals: Deal[];
  onOrderNow?: () => void;
}

const DEAL_TYPE_STYLES: Record<string, { badge: string; accent: string; emoji: string }> = {
  combo:       { badge: 'bg-blue-500/90 text-white',   accent: '#3b82f6', emoji: '🍔' },
  discount:    { badge: 'bg-red-500/90 text-white',    accent: '#ef4444', emoji: '🔥' },
  promotion:   { badge: 'bg-purple-500/90 text-white', accent: '#8b5cf6', emoji: '✨' },
  featured:    { badge: 'bg-amber-500/90 text-white',  accent: '#f59e0b', emoji: '⭐' },
};

const GRADIENT_FALLBACKS = [
  'from-amber-400 to-orange-500',
  'from-blue-400 to-indigo-500',
  'from-rose-400 to-pink-500',
  'from-emerald-400 to-teal-500',
  'from-purple-400 to-violet-500',
];

const PATTERN_EMOJIS = ['🧀', '🍕', '🍔', '🌮', '🍜', '🥙', '🍣', '🥗'];

function SlideBackground({ deal, index }: { deal: Deal; index: number }) {
  const gradient = GRADIENT_FALLBACKS[index % GRADIENT_FALLBACKS.length];
  const style = DEAL_TYPE_STYLES[deal.dealType] ?? DEAL_TYPE_STYLES.featured;

  if (deal.imageUrl) {
    return (
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${deal.imageUrl})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
      </div>
    );
  }

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
      {/* Decorative food emoji pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute text-4xl select-none"
            style={{
              top:  `${(i * 31 + 10) % 80}%`,
              left: `${(i * 47 + 5) % 90}%`,
              transform: `rotate(${(i * 23) % 60 - 30}deg)`,
            }}
          >
            {PATTERN_EMOJIS[i % PATTERN_EMOJIS.length]}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
    </div>
  );
}

export default function HeroSlider({ deals, onOrderNow }: HeroSliderProps) {
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = useCallback((newIdx: number, dir: number) => {
    setDirection(dir);
    setIdx(newIdx);
  }, []);

  const prev = () => goTo((idx - 1 + deals.length) % deals.length, -1);
  const next = useCallback(() => goTo((idx + 1) % deals.length, 1), [idx, deals.length, goTo]);

  // Auto-rotate every 5s
  useEffect(() => {
    if (deals.length <= 1) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next, deals.length]);

  if (deals.length === 0) return null;

  const deal = deals[idx];
  const style = DEAL_TYPE_STYLES[deal.dealType] ?? DEAL_TYPE_STYLES.featured;

  const discountLabel =
    deal.discountValue > 0
      ? deal.discountType === 'percent'
        ? `${deal.discountValue}% OFF`
        : `Save $${deal.discountValue.toFixed(2)}`
      : null;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (d: number) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0 }),
  };

  return (
    <div className="relative h-52 rounded-3xl overflow-hidden shadow-xl shadow-amber-900/15 mb-6">
      <AnimatePresence custom={direction} mode="popLayout">
        <motion.div
          key={deal.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          className="absolute inset-0"
        >
          <SlideBackground deal={deal} index={idx} />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${style.badge}`}>
                {style.emoji} {deal.dealType}
              </span>
              {discountLabel && (
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-white/20 text-white backdrop-blur-sm border border-white/20">
                  {discountLabel}
                </span>
              )}
              {deal.validTo && (
                <span className="text-[10px] text-white/60 flex items-center gap-1 ml-auto">
                  <Clock size={10} />
                  Ends {new Date(deal.validTo).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="font-display font-black text-white text-xl leading-tight drop-shadow-md mb-1">
              {deal.title}
            </h2>
            {deal.description && (
              <p className="text-white/70 text-xs line-clamp-1">{deal.description}</p>
            )}

            {/* CTA */}
            {onOrderNow && (
              <button
                onClick={onOrderNow}
                className="btn-press mt-3 self-start px-4 py-2 bg-white text-[#1c1714] rounded-xl text-xs font-display font-black hover:bg-amber-50 transition-colors shadow-lg"
              >
                Order Now →
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      {deals.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-all z-10"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-all z-10"
          >
            <ChevronRight size={14} />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {deals.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > idx ? 1 : -1)}
                className={`transition-all rounded-full ${
                  i === idx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
