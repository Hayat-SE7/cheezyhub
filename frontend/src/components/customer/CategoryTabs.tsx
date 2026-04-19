'use client';

import { clsx } from 'clsx';
import { useRef } from 'react';

interface CategoryTabsProps {
  categories: { id: string; name: string }[];
  active: string;
  onChange: (id: string) => void;
}

export default function CategoryTabs({ categories, active, onChange }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={clsx(
            'flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all',
            active === cat.id
              ? 'bg-amber-500 text-[#1e1208] font-bold shadow-md shadow-amber-500/30'
              : 'bg-[#3d2a15] text-[#a07850] border border-[#4a3520] hover:border-amber-500/40'
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
