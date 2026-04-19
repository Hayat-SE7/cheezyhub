'use client';

import { useEffect, useState, useCallback } from 'react';
import { menuApi, dealsApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { AlertCircle, Search, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import HeroSlider from '@/components/customer/HeroSlider';
import DealsSection from '@/components/customer/DealsSection';
import MenuItemCard from '@/components/customer/MenuItemCard';
import ItemBottomSheet from '@/components/customer/ItemBottomSheet';
import DealBottomSheet from '@/components/customer/DealBottomSheet';
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
  linkedItems?: MenuItem[];
}

// ─── Main Homepage ────────────────────────────────────

const SKELETON_ITEMS = [...Array(5)];

export default function CustomerMenuPage() {
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [deals,        setDeals]        = useState<Deal[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [ordersPaused, setOrdersPaused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchQuery,  setSearchQuery]  = useState('');

  // Bottom sheet state
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dealSheetDeal, setDealSheetDeal] = useState<Deal | null>(null);
  const [dealSheetOpen, setDealSheetOpen] = useState(false);

  const openSheet = useCallback((item: MenuItem) => {
    setSheetItem(item);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const openDealSheet = useCallback((deal: Deal) => {
    if (deal.linkedItems && deal.linkedItems.length > 0) {
      setDealSheetDeal(deal);
      setDealSheetOpen(true);
    }
  }, []);

  const closeDealSheet = useCallback(() => {
    setDealSheetOpen(false);
  }, []);

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

  const allItems = categories.flatMap((c) => c.items);

  const searchResults = searchQuery
    ? allItems.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const activeItems = searchQuery
    ? searchResults
    : (categories.find((c) => c.id === activeCategory)?.items ?? []);

  const popularItems = allItems
    .filter((i) => i.isAvailable)
    .slice(0, 4);

  const sliderDeals  = deals.filter((d) => d.displayLocation === 'slider' || d.displayLocation === 'both');
  const sectionDeals = deals.filter((d) => d.displayLocation === 'deals_section' || d.displayLocation === 'both');

  const DEALS_CATEGORY_ID = '__deals__';
  const showDealsTab = deals.length > 0;

  if (loading) {
    return (
      <div className="pt-4 space-y-4">
        <div className="skeleton h-52 rounded-3xl" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 w-52 rounded-2xl flex-shrink-0" />)}
        </div>
        <div className="space-y-0">
          {SKELETON_ITEMS.map((_, i) => <div key={i} className="skeleton h-20 rounded-none border-b border-[#3d2a15]" />)}
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
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#3d2a15] border border-[#4a3520] text-[#f5d38e] text-sm placeholder:text-[#7a6040] outline-none focus:border-amber-500/40 transition-colors"
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
        <DealsSection deals={sectionDeals} onSelectDeal={openDealSheet} />
      )}

      {/* Popular Items */}
      {!searchQuery && popularItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={15} className="text-amber-500" />
            <span className="text-[10px] font-bold text-[#f5d38e] uppercase tracking-widest">Popular</span>
          </div>
          <div className="bg-[#2d1e0f] rounded-2xl border border-[#3d2a15] overflow-hidden">
            {popularItems.map((item, idx) => (
              <MenuItemCard
                key={item.id}
                item={item}
                paused={ordersPaused}
                index={idx}
                onOpenSheet={openSheet}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category tabs */}
      {!searchQuery && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3" style={{ scrollbarWidth: 'none' }}>
          {showDealsTab && (
            <button
              onClick={() => setActiveCategory(DEALS_CATEGORY_ID)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-display font-bold transition-all ${
                DEALS_CATEGORY_ID === activeCategory
                  ? 'bg-amber-500 text-[#1e1208] shadow-md shadow-amber-500/30'
                  : 'bg-[#3d2a15] text-[#a07850] border border-[#4a3520] hover:border-amber-500/40'
              }`}
            >
              🎁 Deals
            </button>
          )}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-display font-bold transition-all ${
                cat.id === activeCategory
                  ? 'bg-amber-500 text-[#1e1208] shadow-md shadow-amber-500/30'
                  : 'bg-[#3d2a15] text-[#a07850] border border-[#4a3520] hover:border-amber-500/40'
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
          <div className="text-sm text-[#a07850] font-semibold">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
          </div>
          <button onClick={() => setSearchQuery('')} className="text-xs text-amber-500 font-semibold">
            Clear
          </button>
        </div>
      )}

      {/* Deals tab content */}
      {!searchQuery && activeCategory === DEALS_CATEGORY_ID ? (
        <DealsSection deals={deals} onSelectDeal={openDealSheet} />
      ) : (
        <>
          {/* Menu section header */}
          {!searchQuery && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-[#f5d38e] uppercase tracking-widest">
                {categories.find((c) => c.id === activeCategory)?.name ?? 'Menu'}
              </span>
              <span className="text-[10px] text-[#a07850] bg-[#3d2a15] px-2 py-0.5 rounded-full">
                {activeItems.filter((i) => i.isAvailable).length} available
              </span>
              <div className="flex-1 h-px bg-[#3d2a15]" />
            </div>
          )}

          {/* Menu items list */}
          <div className="bg-[#2d1e0f] rounded-2xl border border-[#3d2a15] overflow-hidden">
            {activeItems.map((item, idx) => (
              <MenuItemCard
                key={item.id}
                item={item}
                paused={ordersPaused}
                index={idx}
                onOpenSheet={openSheet}
              />
            ))}
            {activeItems.length === 0 && (
              <EmptyState
                icon="🔍"
                title="Nothing found"
                description={searchQuery ? `No items match "${searchQuery}"` : 'No items in this category'}
                className="py-16"
              />
            )}
          </div>
        </>
      )}

      {/* Item bottom sheet */}
      <ItemBottomSheet
        item={sheetItem}
        isOpen={sheetOpen}
        onClose={closeSheet}
      />

      {/* Deal bottom sheet */}
      <DealBottomSheet
        deal={dealSheetDeal}
        isOpen={dealSheetOpen}
        onClose={closeDealSheet}
      />
    </div>
  );
}
