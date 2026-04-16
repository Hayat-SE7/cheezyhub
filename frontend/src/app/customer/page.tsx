'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { menuApi, dealsApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { useCartStore } from '@/store/cartStore';
import { AlertCircle, ShoppingCart, Search, Star, Flame, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import HeroSlider from '@/components/customer/HeroSlider';
import DealsSection from '@/components/customer/DealsSection';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Types ───────────────────────────────────────────

interface Modifier {
  id: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  modifiers: Modifier[];
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  isAvailable: boolean;
  modifierGroups: ModifierGroup[];
}

interface Category {
  id: string;
  name: string;
  items: MenuItem[];
}

interface Deal {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  dealType: string;
  discountType: string;
  discountValue: number;
  displayLocation: string;
  validTo?: string;
}

// ─── Menu Item Card (Visual) ────────────────────────

function MenuCard({ item, paused, index }: { item: MenuItem; paused: boolean; index: number }) {
  const addItem = useCartStore((s) => s.addItem);
  const [adding, setAdding] = useState(false);
  const [showModifiers, setShowModifiers] = useState(false);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const hasModifiers = item.modifierGroups.length > 0;

  const getSelectedCount = () =>
    Object.values(selected).flat().length;

  const getModifierTotal = () => {
    let extra = 0;
    for (const group of item.modifierGroups) {
      for (const mod of group.modifiers) {
        if ((selected[group.id] ?? []).includes(mod.id)) {
          extra += mod.priceAdjustment;
        }
      }
    }
    return extra;
  };

  const toggleMod = (groupId: string, modId: string, multiSelect: boolean) => {
    setSelected((prev) => {
      const curr = prev[groupId] ?? [];
      if (curr.includes(modId)) {
        return { ...prev, [groupId]: curr.filter((id) => id !== modId) };
      }
      return { ...prev, [groupId]: multiSelect ? [...curr, modId] : [modId] };
    });
  };

  const handleAdd = () => {
    // Check required groups
    for (const group of item.modifierGroups) {
      if (group.required && !(selected[group.id]?.length)) {
        setShowModifiers(true);
        toast.error(`Please choose a ${group.name}`);
        return;
      }
    }

    const selectedModifiers = item.modifierGroups.flatMap((g) =>
      g.modifiers.filter((m) => (selected[g.id] ?? []).includes(m.id))
    );
    const unitPrice = item.basePrice + getModifierTotal();

    setAdding(true);
    addItem({
      menuItemId:         item.id,
      name:               item.name,
      quantity:           1,
      unitPrice,
      totalPrice:         unitPrice,
      selectedModifiers:  selectedModifiers.map((m) => ({ id: m.id, name: m.name, priceAdjustment: m.priceAdjustment })),
    });

    toast.success(`${item.name} added to cart!`, {
      icon: '🛒',
      style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' },
    });

    setTimeout(() => setAdding(false), 800);
    setShowModifiers(false);
    setSelected({});
  };

  const totalPrice = item.basePrice + getModifierTotal();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className={`bg-[#1A1208] rounded-2xl border border-[#3D2E12] overflow-hidden ${
        !item.isAvailable ? 'opacity-50' : 'hover:border-[#5A4020] transition-all'
      }`}
    >
      <div className="flex gap-0">
        {/* Left: text content */}
        <div className="flex-1 p-4">
          <h3 className={`font-display font-bold text-[#F5E6C8] text-sm leading-tight ${!item.isAvailable ? 'line-through' : ''}`}>
            {item.name}
          </h3>
          {item.description && (
            <p className="text-[#7A6040] text-xs mt-0.5 line-clamp-2 leading-relaxed">{item.description}</p>
          )}

          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="font-display font-black text-amber-600 text-base">
                ${item.basePrice.toFixed(2)}
              </span>
              {getModifierTotal() > 0 && (
                <span className="text-amber-500/60 text-[11px] ml-1">
                  +${getModifierTotal().toFixed(2)}
                </span>
              )}
            </div>

            {item.isAvailable && !paused ? (
              hasModifiers ? (
                <button
                  onClick={() => setShowModifiers(!showModifiers)}
                  className="btn-press flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-display font-bold transition-all shadow-md shadow-amber-200"
                >
                  Customize
                  <ChevronRight size={12} className={`transition-transform ${showModifiers ? 'rotate-90' : ''}`} />
                </button>
              ) : (
                <button
                  onClick={handleAdd}
                  className={`btn-press flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-display font-bold transition-all shadow-md shadow-amber-200 ${
                    adding
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {adding ? '✓ Added' : '+ Add'}
                </button>
              )
            ) : (
              <span className="text-[11px] text-[#7A6040] bg-[#2D1F08] px-3 py-1.5 rounded-xl">
                {paused ? 'Paused' : 'Unavailable'}
              </span>
            )}
          </div>
        </div>

        {/* Right: image */}
        <div className="w-28 h-28 flex-shrink-0 relative">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2D1F08] to-[#1A1208] flex items-center justify-center">
              <span className="text-4xl">{
                item.name.toLowerCase().includes('pizza') ? '🍕' :
                item.name.toLowerCase().includes('burger') ? '🍔' :
                item.name.toLowerCase().includes('pasta') ? '🍝' :
                item.name.toLowerCase().includes('salad') ? '🥗' :
                item.name.toLowerCase().includes('juice') ? '🧃' :
                item.name.toLowerCase().includes('drink') ? '🥤' :
                item.name.toLowerCase().includes('soup') ? '🍲' :
                item.name.toLowerCase().includes('sandwich') ? '🥪' :
                '🧀'
              }</span>
            </div>
          )}
        </div>
      </div>

      {/* Modifier panel */}
      {showModifiers && (
        <div className="border-t border-[#3D2E12] bg-[#120D06] p-4 animate-fade-in">
          {item.modifierGroups.map((group) => (
            <div key={group.id} className="mb-3 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-[#A0886A] uppercase tracking-wide">{group.name}</span>
                {group.required && <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full font-bold border border-amber-500/20">Required</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.modifiers.filter((m) => m.isAvailable).map((mod) => {
                  const isSelected = (selected[group.id] ?? []).includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleMod(group.id, mod.id, group.multiSelect)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-[#0F0A04] border-amber-500'
                          : 'bg-[#1A1208] text-[#7A6040] border-[#3D2E12] hover:border-[#D97706]/40'
                      }`}
                    >
                      {mod.name}
                      {mod.priceAdjustment > 0 && (
                        <span className={`ml-1 ${isSelected ? 'text-amber-100' : 'text-[#a39083]'}`}>
                          +${mod.priceAdjustment.toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#3D2E12]">
            <span className="font-display font-bold text-[#F5E6C8]">${totalPrice.toFixed(2)}</span>
            <button
              onClick={handleAdd}
              className="btn-press flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-display font-bold transition-all shadow-md shadow-amber-200"
            >
              <ShoppingCart size={14} /> Add to Cart
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Featured Items Grid ──────────────────────────────

function FeaturedSection({ items, paused }: { items: MenuItem[]; paused: boolean }) {
  const addItem = useCartStore((s) => s.addItem);
  if (items.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-3">
        <Flame size={16} className="text-amber-500" />
        <h2 className="font-display font-bold text-[#F5E6C8] text-base">Popular Items</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.slice(0, 4).map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className="bg-[#1A1208] rounded-2xl border border-[#3D2E12] overflow-hidden hover:border-[#5A4020] transition-all"
          >
            {/* Image */}
            <div className="h-28 relative overflow-hidden">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#2D1F08] to-[#1A1208] flex items-center justify-center">
                  <span className="text-5xl">🧀</span>
                </div>
              )}
              <div className="absolute top-2 left-2">
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-900/70 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  <Star size={9} fill="currentColor" /> Popular
                </span>
              </div>
            </div>
            <div className="p-3">
              <div className="font-display font-bold text-[#F5E6C8] text-xs leading-tight line-clamp-1">{item.name}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="font-display font-black text-amber-600 text-sm">${item.basePrice.toFixed(2)}</span>
                <button
                  onClick={() => {
                    if (paused || !item.isAvailable) return;
                    addItem({ menuItemId: item.id, name: item.name, quantity: 1, unitPrice: item.basePrice, totalPrice: item.basePrice, selectedModifiers: [] });
                    toast.success(`${item.name} added!`, { icon: '🛒' });
                  }}
                  disabled={paused || !item.isAvailable}
                  className="btn-press w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center justify-center font-bold text-lg leading-none transition-all"
                >
                  +
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Homepage ────────────────────────────────────

const SKELETON_ITEMS = [...Array(4)];

export default function CustomerMenuPage() {
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [deals,        setDeals]        = useState<Deal[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [ordersPaused, setOrdersPaused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchQuery,  setSearchQuery]  = useState('');

  useEffect(() => {
    Promise.all([
      menuApi.getPublic(),
      dealsApi.getActive().catch(() => ({ data: { data: [] } })),
    ]).then(([menuRes, dealsRes]) => {
      const cats = menuRes.data.data;
      setCategories(cats);
      setDeals(dealsRes.data.data);
      if (cats.length > 0) setActiveCategory(cats[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useSSE({
    onEvent: {
      ORDERS_PAUSED: (data: any) => {
        setOrdersPaused(data.paused);
        toast(data.paused ? 'Orders temporarily paused' : '✅ Orders are back!', { icon: data.paused ? '⏸' : '🎉' });
      },
      ITEM_AVAILABILITY: (data: any) => {
        setCategories((cats) =>
          cats.map((cat) => ({
            ...cat,
            items: cat.items.map((item) =>
              item.id === data.itemId ? { ...item, isAvailable: data.isAvailable } : item
            ),
          }))
        );
      },
      MODIFIER_AVAILABILITY: (data: any) => {
        setCategories((cats) =>
          cats.map((cat) => ({
            ...cat,
            items: cat.items.map((item) => ({
              ...item,
              modifierGroups: item.modifierGroups.map((g) => ({
                ...g,
                modifiers: g.modifiers.map((m) =>
                  m.id === data.modifierId ? { ...m, isAvailable: data.isAvailable } : m
                ),
              })),
            })),
          }))
        );
      },
    },
  });

  // Search filter
  const allItems = categories.flatMap((c) => c.items);
  const searchResults = searchQuery
    ? allItems.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // Active category items
  const activeItems = searchQuery
    ? searchResults
    : (categories.find((c) => c.id === activeCategory)?.items ?? []);

  // Popular items = up to 4 items that have images (or just first items)
  const popularItems = allItems.filter((i) => i.isAvailable && i.imageUrl).slice(0, 4)
    .concat(allItems.filter((i) => i.isAvailable && !i.imageUrl).slice(0, 4 - Math.min(4, allItems.filter((i) => i.isAvailable && i.imageUrl).length)))
    .slice(0, 4);

  // Deals for different locations
  const sliderDeals = deals.filter((d) => d.displayLocation === 'slider' || d.displayLocation === 'both');
  const sectionDeals = deals.filter((d) => d.displayLocation === 'deals_section' || d.displayLocation === 'both');

  if (loading) {
    return (
      <div className="pt-4 space-y-4">
        {/* Hero skeleton */}
        <div className="skeleton h-52 rounded-3xl" />
        {/* Deals skeleton */}
        <div className="flex gap-3 overflow-hidden">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 w-52 rounded-2xl flex-shrink-0" />)}
        </div>
        {/* Items skeleton */}
        <div className="space-y-3">
          {SKELETON_ITEMS.map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4">
      {/* Paused banner */}
      {ordersPaused && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20"
        >
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-amber-400 text-sm font-display font-bold">Kitchen taking a break</div>
            <div className="text-amber-500/70 text-xs">Check back shortly — we&apos;ll be back soon!</div>
          </div>
        </motion.div>
      )}

      {/* Search bar */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7A6040]" />
        <input
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#1A1208] border border-[#3D2E12] text-[#F5E6C8] text-sm placeholder:text-[#5A4030] outline-none focus:border-[#D97706]/40 transition-colors"
          placeholder="Search menu..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Hero Slider */}
      {!searchQuery && sliderDeals.length > 0 && (
        <HeroSlider
          deals={sliderDeals}
          onOrderNow={() => window.scrollTo({ top: window.innerHeight * 0.9, behavior: 'smooth' })}
        />
      )}

      {/* Deals Section */}
      {!searchQuery && sectionDeals.length > 0 && (
        <DealsSection deals={sectionDeals} />
      )}

      {/* Featured / Popular items */}
      {!searchQuery && popularItems.length > 0 && (
        <FeaturedSection items={popularItems} paused={ordersPaused} />
      )}

      {/* Category tabs */}
      {!searchQuery && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4" style={{ scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-display font-bold transition-all ${
                cat.id === activeCategory
                  ? 'bg-[#D97706] text-[#0F0A04] shadow-md shadow-amber-900/30'
                  : 'bg-[#1A1208] text-[#7A6040] border border-[#3D2E12] hover:border-[#D97706]/40'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Search results label */}
      {searchQuery && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-[#A0886A] font-semibold">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
          </div>
          <button onClick={() => setSearchQuery('')} className="text-xs text-[#D97706] font-semibold">
            Clear
          </button>
        </div>
      )}

      {/* Menu section header */}
      {!searchQuery && (
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-display font-bold text-[#1c1714] text-base">
            {categories.find((c) => c.id === activeCategory)?.name ?? 'Menu'}
          </h2>
          <span className="text-[11px] text-[#a39083] bg-[#f5f0e8] px-2 py-0.5 rounded-full">
            {activeItems.filter((i) => i.isAvailable).length} available
          </span>
          <div className="flex-1 h-px bg-[#ece6dc]" />
        </div>
      )}

      {/* Menu items */}
      <div className="flex flex-col gap-3">
        {activeItems.map((item, idx) => (
          <MenuCard key={item.id} item={item} paused={ordersPaused} index={idx} />
        ))}
        {activeItems.length === 0 && (
          <EmptyState icon="🔍" title="Nothing found" description={searchQuery ? `No items match "${searchQuery}"` : 'No items in this category'} className="py-16" />
        )}
      </div>
    </div>
  );
}
