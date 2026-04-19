'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { menuApi } from '@/lib/api';
import MenuItemCard from '@/components/customer/MenuItemCard';
import ItemBottomSheet from '@/components/customer/ItemBottomSheet';
import { clsx } from 'clsx';
import { Search } from 'lucide-react';

interface MenuItem {
  id: string; name: string; description?: string; basePrice: number; imageUrl?: string; isAvailable: boolean; modifierGroups: any[];
}
interface Category {
  id: string; name: string; items: MenuItem[];
}

export default function MenuPage() {
  const [paused,   setPaused]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [activeId, setActiveId] = useState('');
  const sectionRefs = useRef<Record<string, HTMLElement>>({});

  // Bottom sheet state
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openSheet = useCallback((item: MenuItem) => {
    setSheetItem(item);
    setSheetOpen(true);
  }, []);

  const { data: categories = [], isLoading: loading } = useQuery<Category[]>({
    queryKey: ['menu'],
    staleTime: 60_000,
    queryFn: async () => {
      const r = await menuApi.getAll();
      const cats = r.data.data ?? r.data;
      return Array.isArray(cats) ? cats : [];
    },
  });

  useEffect(() => {
    if (categories.length && !activeId) setActiveId(categories[0].id);
  }, [categories, activeId]);

  useEffect(() => {
    if (!categories.length) return;
    const observers: IntersectionObserver[] = [];
    categories.forEach((cat) => {
      const el = sectionRefs.current[cat.id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(cat.id); },
        { rootMargin: '-40% 0px -55% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [categories]);

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) => !q || item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, search]);

  if (loading) {
    return (
      <div className="space-y-2 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 rounded-none border-b border-[#3d2a15] bg-[#3d2a15]/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-5 pt-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a6040]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the menu…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#3d2a15] border border-[#4a3520] text-[#f5d38e] placeholder-[#7a6040] text-sm focus:outline-none focus:border-amber-500/40"
          />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sticky category sidebar — desktop only */}
        <aside className="hidden lg:block w-44 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollTo(cat.id)}
                className={clsx('w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                  activeId === cat.id
                    ? 'bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/20'
                    : 'text-[#a07850] hover:bg-[#3d2a15] hover:text-[#f5d38e]'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Category scroll — mobile horizontal pills */}
        <div className="lg:hidden -mx-4 px-4 mb-4 overflow-x-auto flex gap-2 pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollTo(cat.id)}
              className={clsx('flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors',
                activeId === cat.id
                  ? 'bg-amber-500 text-[#1e1208]'
                  : 'bg-[#3d2a15] border border-[#4a3520] text-[#a07850]'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="flex-1 space-y-8">
          {filtered.map((cat) => (
            <section
              key={cat.id}
              ref={(el) => { if (el) sectionRefs.current[cat.id] = el as HTMLElement; }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-[#f5d38e] uppercase tracking-widest">{cat.name}</span>
                <div className="flex-1 h-px bg-[#3d2a15]" />
              </div>
              <div className="bg-[#2d1e0f] rounded-2xl border border-[#3d2a15] overflow-hidden">
                {cat.items.map((item, i) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    paused={paused}
                    index={i}
                    onOpenSheet={openSheet}
                  />
                ))}
              </div>
            </section>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-[#a07850]">
              <p className="text-4xl mb-3">🔍</p>
              <p>Nothing found for &ldquo;{search}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* Item bottom sheet */}
      <ItemBottomSheet
        item={sheetItem}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
