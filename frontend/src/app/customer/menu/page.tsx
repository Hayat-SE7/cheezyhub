'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { menuApi } from '@/lib/api';
import MenuItemCard from '@/components/customer/MenuItemCard';
import { clsx } from 'clsx';
import { Search, SlidersHorizontal } from 'lucide-react';

interface MenuItem {
  id: string; name: string; description?: string; basePrice: number; imageUrl?: string; isAvailable: boolean; modifierGroups: any[];
}
interface Category {
  id: string; name: string; items: MenuItem[];
}

export default function MenuPage() {
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading,    setLoading]      = useState(true);
  const [paused,     setPaused]       = useState(false);
  const [search,     setSearch]       = useState('');
  const [activeId,   setActiveId]     = useState('');
  const sectionRefs = useRef<Record<string, HTMLElement>>({});

  useEffect(() => {
    menuApi.getAll()
      .then((r) => {
        const cats = r.data.data ?? r.data;
        setCategories(Array.isArray(cats) ? cats : []);
        if (cats[0]) setActiveId(cats[0].id);
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  // IntersectionObserver: persist active category on scroll
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

  const filtered = categories.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase())),
  })).filter((cat) => cat.items.length > 0);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white border border-[#ece6dc] h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Search + pause bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a39083]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the menu…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#ece6dc] text-[#1c1714] placeholder-[#a39083] text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
        <button
          onClick={() => setPaused((v) => !v)}
          className={clsx('flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors', paused ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-white border border-[#ece6dc] text-[#5c5147] hover:border-amber-300')}
        >
          <SlidersHorizontal size={14} /> {paused ? 'Paused' : 'Live'}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sticky category sidebar — desktop only */}
        <aside className="hidden lg:block w-44 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollTo(cat.id)}
                className={clsx('w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors', activeId === cat.id ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-[#5c5147] hover:bg-[#f5f0e8]')}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Category scroll — mobile horizontal pills */}
        <div className="lg:hidden -mx-4 px-4 mb-4 overflow-x-auto flex gap-2 pb-1">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => scrollTo(cat.id)} className={clsx('flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors', activeId === cat.id ? 'bg-amber-500 text-white' : 'bg-white border border-[#ece6dc] text-[#5c5147]')}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="flex-1 space-y-8">
          {filtered.map((cat) => (
            <section key={cat.id} ref={(el) => { if (el) sectionRefs.current[cat.id] = el as HTMLElement; }}>
              <h2 className="font-display font-bold text-xl text-[#1c1714] mb-4">{cat.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {cat.items.map((item, i) => (
                  <MenuItemCard key={item.id} item={item} paused={paused} index={i} />
                ))}
              </div>
            </section>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-[#a39083]">
              <p className="text-4xl mb-3">🔍</p>
              <p>Nothing found for "{search}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
