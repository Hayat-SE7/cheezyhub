'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus, Minus, Check, ChevronDown } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

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

export default function MenuItemCard({
  item,
  paused,
  index = 0,
}: {
  item: MenuItem;
  paused: boolean;
  index?: number;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const [expanded, setExpanded] = useState(false);
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [justAdded, setJustAdded] = useState(false);

  const hasModifiers = item.modifierGroups.length > 0;
  const disabled = !item.isAvailable || paused;

  const calcPrice = () => {
    const modPrice = Object.values(selected)
      .flat()
      .reduce((sum, modId) => {
        const mod = item.modifierGroups
          .flatMap((g) => g.modifiers)
          .find((m) => m.id === modId);
        return sum + (mod?.priceAdjustment ?? 0);
      }, 0);
    return (item.basePrice + modPrice) * qty;
  };

  const toggleModifier = (groupId: string, modId: string, multiSelect: boolean) => {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (multiSelect) {
        return {
          ...prev,
          [groupId]: current.includes(modId)
            ? current.filter((id) => id !== modId)
            : [...current, modId],
        };
      }
      return { ...prev, [groupId]: current[0] === modId ? [] : [modId] };
    });
  };

  const handleAdd = () => {
    const missing = item.modifierGroups.filter(
      (g) => g.required && !(selected[g.id]?.length > 0)
    );
    if (missing.length > 0) {
      toast.error(`Please choose ${missing[0].name}`);
      return;
    }

    const allMods = item.modifierGroups.flatMap((g) => g.modifiers);
    const selectedMods = Object.values(selected)
      .flat()
      .map((id) => allMods.find((m) => m.id === id)!)
      .filter(Boolean);

    const unitPrice = item.basePrice + selectedMods.reduce((s, m) => s + m.priceAdjustment, 0);

    addItem({
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      quantity: qty,
      unitPrice,
      totalPrice: unitPrice * qty,
      selectedModifiers: selectedMods.map((m) => ({
        id: m.id,
        name: m.name,
        priceAdjustment: m.priceAdjustment,
      })),
    });

    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
    toast.success(`${item.name} added!`, { icon: '🧀' });

    if (hasModifiers) {
      setExpanded(false);
      setQty(1);
      setSelected({});
    }
  };

  return (
    <div
      className={clsx(
        'card-lift rounded-2xl bg-white border border-[#ece6dc] overflow-hidden transition-all animate-slide-up',
        disabled && 'opacity-55 pointer-events-none'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* ── Main row ─── */}
      <div
        className="flex items-start gap-4 p-4 cursor-pointer"
        onClick={() => !disabled && hasModifiers && setExpanded(!expanded)}
      >
        {/* Image */}
        {item.imageUrl ? (
          <div className="relative w-[84px] h-[84px] rounded-xl overflow-hidden flex-shrink-0 bg-amber-50">
            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
          </div>
        ) : (
          <div className="w-[84px] h-[84px] rounded-xl flex-shrink-0 bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center text-3xl">
            🍔
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-bold text-[#1c1714] text-[15px] leading-snug">
              {item.name}
            </h3>
            <div className="flex-shrink-0 text-right">
              <span className="font-display font-bold text-amber-600 text-[15px]">
                ${item.basePrice.toFixed(2)}
              </span>
            </div>
          </div>

          {item.description && (
            <p className="text-[#a39083] text-[13px] mt-1 leading-snug line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Tags */}
          <div className="flex items-center gap-2 mt-2.5">
            {!item.isAvailable && (
              <span className="text-[11px] px-2 py-0.5 bg-red-50 text-red-500 rounded-full font-semibold border border-red-100">
                Sold Out
              </span>
            )}
            {hasModifiers && (
              <span className="text-[11px] text-[#a39083] flex items-center gap-1">
                Customizable
                <ChevronDown
                  size={12}
                  className={clsx('transition-transform duration-200', expanded && 'rotate-180')}
                />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Simple add (no modifiers) ─── */}
      {!hasModifiers && !disabled && (
        <div className="px-4 pb-4">
          <button
            onClick={handleAdd}
            className={clsx(
              'btn-press w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300',
              justAdded
                ? 'bg-green-500 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 hover:border-amber-300'
            )}
          >
            {justAdded ? (
              <><Check size={15} /> Added!</>
            ) : (
              <><Plus size={15} /> Add to cart</>
            )}
          </button>
        </div>
      )}

      {/* ── Expanded modifier panel ─── */}
      {expanded && !disabled && (
        <div className="border-t border-[#ece6dc] bg-[#faf9f6] px-4 pb-5 pt-4 animate-fade-in">
          {item.modifierGroups.map((group) => (
            <div key={group.id} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="font-display font-bold text-[13px] text-[#1c1714]">
                  {group.name}
                </span>
                {group.required && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold uppercase tracking-wide">
                    Required
                  </span>
                )}
                {group.multiSelect && !group.required && (
                  <span className="text-[10px] text-[#a39083]">Pick multiple</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.modifiers.map((mod) => {
                  const isSelected = selected[group.id]?.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      disabled={!mod.isAvailable}
                      onClick={() => toggleModifier(group.id, mod.id, group.multiSelect)}
                      className={clsx(
                        'btn-press flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-all duration-150',
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-300/50'
                          : 'bg-white text-[#5c5147] border-[#ece6dc] hover:border-amber-300 hover:bg-amber-50',
                        !mod.isAvailable && 'opacity-35 cursor-not-allowed'
                      )}
                    >
                      {isSelected && <Check size={11} />}
                      {mod.name}
                      {mod.priceAdjustment > 0 && (
                        <span className={clsx('text-[11px]', isSelected ? 'opacity-80' : 'text-amber-600')}>
                          +${mod.priceAdjustment.toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Qty + Add button */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#ece6dc]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="btn-press w-9 h-9 rounded-xl border border-[#ece6dc] bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <Minus size={14} className="text-[#5c5147]" />
              </button>
              <span className="font-display font-bold text-lg w-9 text-center text-[#1c1714]">
                {qty}
              </span>
              <button
                onClick={() => setQty(qty + 1)}
                className="btn-press w-9 h-9 rounded-xl border border-[#ece6dc] bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <Plus size={14} className="text-[#5c5147]" />
              </button>
            </div>

            <button
              onClick={handleAdd}
              className="btn-press flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-display font-bold text-[13px] shadow-md shadow-amber-400/30 transition-all"
            >
              <Plus size={14} /> Add · ${calcPrice().toFixed(2)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
