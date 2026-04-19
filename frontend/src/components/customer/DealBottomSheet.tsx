'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Check, X, ShoppingCart, Tag, Package } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface Modifier {
  id:              string;
  name:            string;
  priceAdjustment: number;
  isAvailable:     boolean;
}

interface ModifierGroup {
  id:          string;
  name:        string;
  required:    boolean;
  multiSelect: boolean;
  modifiers:   Modifier[];
}

interface LinkedItem {
  id:             string;
  name:           string;
  description?:   string;
  basePrice:      number;
  imageUrl?:      string;
  isAvailable:    boolean;
  modifierGroups: ModifierGroup[];
}

interface Deal {
  id:            string;
  title:         string;
  description?:  string | null;
  imageUrl?:     string | null;
  dealType:      string;
  discountType:  string;
  discountValue: number;
  linkedItems?:  LinkedItem[];
}

interface Props {
  deal:    Deal | null;
  isOpen:  boolean;
  onClose: () => void;
}

function getItemEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes('pizza'))    return '🍕';
  if (n.includes('burger'))   return '🍔';
  if (n.includes('pasta'))    return '🍝';
  if (n.includes('drink') || n.includes('cola') || n.includes('pepsi')) return '🥤';
  if (n.includes('fries'))    return '🍟';
  if (n.includes('chicken'))  return '🍗';
  if (n.includes('shawarma')) return '🌯';
  return '🧀';
}

export default function DealBottomSheet({ deal, isOpen, onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [qty, setQty] = useState(1);
  // Per-item modifier selections: { [itemId]: { [groupId]: string[] } }
  const [selections, setSelections] = useState<Record<string, Record<string, string[]>>>({});

  useEffect(() => {
    if (isOpen) { setQty(1); setSelections({}); }
  }, [isOpen, deal?.id]);

  if (!deal || !deal.linkedItems || deal.linkedItems.length === 0) return null;

  const items = deal.linkedItems.filter((i) => i.isAvailable);

  const toggleMod = (itemId: string, groupId: string, modId: string, multiSelect: boolean) => {
    setSelections((prev) => {
      const itemSel = prev[itemId] ?? {};
      const curr = itemSel[groupId] ?? [];
      const updated = multiSelect
        ? curr.includes(modId) ? curr.filter((id) => id !== modId) : [...curr, modId]
        : curr[0] === modId ? [] : [modId];
      return { ...prev, [itemId]: { ...itemSel, [groupId]: updated } };
    });
  };

  const getItemModPrice = (item: LinkedItem) => {
    let extra = 0;
    const itemSel = selections[item.id] ?? {};
    for (const group of item.modifierGroups) {
      for (const mod of group.modifiers) {
        if ((itemSel[group.id] ?? []).includes(mod.id)) extra += mod.priceAdjustment;
      }
    }
    return extra;
  };

  // Calculate total before discount
  const subtotal = items.reduce((sum, item) => sum + item.basePrice + getItemModPrice(item), 0);

  // Apply deal discount
  const discount = deal.discountType === 'percent'
    ? subtotal * (deal.discountValue / 100)
    : deal.discountValue;
  const totalAfterDiscount = Math.max(0, subtotal - discount) * qty;

  const handleAdd = () => {
    // Validate required modifiers for each item
    for (const item of items) {
      const itemSel = selections[item.id] ?? {};
      const missing = item.modifierGroups.filter((g) => g.required && !(itemSel[g.id]?.length > 0));
      if (missing.length > 0) {
        toast.error(`Choose ${missing[0].name} for ${item.name}`);
        return;
      }
    }

    // Add each item to cart with deal pricing
    for (const item of items) {
      const itemSel = selections[item.id] ?? {};
      const allMods = item.modifierGroups.flatMap((g) => g.modifiers);
      const selectedMods = Object.values(itemSel).flat()
        .map((id) => allMods.find((m) => m.id === id)!)
        .filter(Boolean);

      const itemSubtotal = item.basePrice + getItemModPrice(item);
      // Distribute discount proportionally across items
      const itemShare = subtotal > 0 ? itemSubtotal / subtotal : 1 / items.length;
      const itemDiscount = discount * itemShare;
      const unitPrice = Math.max(0, itemSubtotal - itemDiscount);

      addItem({
        menuItemId:        item.id,
        name:              `${item.name} (${deal.title})`,
        imageUrl:          item.imageUrl,
        quantity:          qty,
        unitPrice,
        totalPrice:        unitPrice * qty,
        selectedModifiers: selectedMods.map((m) => ({ id: m.id, name: m.name, priceAdjustment: m.priceAdjustment })),
      });
    }

    toast.success(`${deal.title} added to cart!`, {
      icon: '🎁',
      style: { background: '#3d2a15', color: '#f5d38e', border: '1px solid #4a3520' },
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[101] max-w-lg mx-auto"
          >
            <div className="bg-[#1e1208] rounded-t-3xl shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#4a3520]" />
              </div>

              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#3d2a15] flex items-center justify-center text-[#a07850] hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              <div className="px-5 pb-8 pt-2">
                {/* Deal header */}
                <div className="flex flex-col items-center mb-5">
                  <div className="w-20 h-20 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-3 overflow-hidden">
                    {deal.imageUrl ? (
                      <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🎁</span>
                    )}
                  </div>
                  <h2 className="font-display font-bold text-[#f5d38e] text-xl text-center">{deal.title}</h2>
                  {deal.description && (
                    <p className="text-[#a07850] text-sm text-center mt-1">{deal.description}</p>
                  )}
                  {deal.discountValue > 0 && (
                    <div className="mt-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/25">
                      <span className="text-red-400 font-bold text-sm">
                        {deal.discountType === 'percent' ? `${deal.discountValue}% OFF` : `Rs. ${deal.discountValue} OFF`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Linked items */}
                <div className="space-y-4 mb-5">
                  <div className="flex items-center gap-2">
                    <Package size={13} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-[#f5d38e] uppercase tracking-widest">
                      Items in this deal ({items.length})
                    </span>
                  </div>

                  {items.map((item) => (
                    <div key={item.id} className="bg-[#2d1e0f] rounded-2xl border border-[#3d2a15] p-4">
                      {/* Item header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-[#3d2a15] flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">{getItemEmoji(item.name)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-bold text-[#f5d38e] text-sm">{item.name}</h3>
                          <span className="text-amber-500/60 text-xs">Rs. {item.basePrice.toFixed(0)}</span>
                        </div>
                      </div>

                      {/* Modifier groups for this item */}
                      {item.modifierGroups.length > 0 && (
                        <div className="space-y-3">
                          {item.modifierGroups.map((group) => (
                            <div key={group.id}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold text-[#a07850] uppercase tracking-wider">{group.name}</span>
                                {group.required && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-bold border border-amber-500/30">
                                    Required
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.modifiers.filter((m) => m.isAvailable).map((mod) => {
                                  const isSelected = (selections[item.id]?.[group.id] ?? []).includes(mod.id);
                                  return (
                                    <button
                                      key={mod.id}
                                      onClick={() => toggleMod(item.id, group.id, mod.id, group.multiSelect)}
                                      className={clsx(
                                        'flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all',
                                        isSelected
                                          ? 'bg-amber-500 text-[#1e1208] border-amber-500'
                                          : 'bg-[#3d2a15] text-[#a07850] border-[#4a3520] hover:border-amber-500/40'
                                      )}
                                    >
                                      {isSelected && <Check size={10} />}
                                      {mod.name}
                                      {mod.priceAdjustment > 0 && (
                                        <span className={clsx('text-[10px]', isSelected ? 'text-amber-100' : 'text-amber-500/60')}>
                                          +Rs.{mod.priceAdjustment.toFixed(0)}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Price breakdown */}
                {deal.discountValue > 0 && (
                  <div className="flex items-center justify-between text-xs text-[#7a6040] mb-1 px-1">
                    <span>Subtotal</span>
                    <span className="line-through">Rs. {(subtotal * qty).toFixed(0)}</span>
                  </div>
                )}

                <div className="border-t border-[#3d2a15] my-4" />

                {/* Qty + Add */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-[#3d2a15] rounded-2xl px-3 py-2">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="w-8 h-8 rounded-xl bg-[#4a3520] flex items-center justify-center text-[#f5d38e] hover:bg-[#5a4530] transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-display font-bold text-white text-lg w-8 text-center">{qty}</span>
                    <button
                      onClick={() => setQty(qty + 1)}
                      className="w-8 h-8 rounded-xl bg-[#4a3520] flex items-center justify-center text-[#f5d38e] hover:bg-[#5a4530] transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    onClick={handleAdd}
                    className="flex-1 flex items-center justify-center gap-2.5 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-display font-bold text-sm shadow-lg shadow-amber-500/30 transition-all"
                  >
                    <ShoppingCart size={16} />
                    Add Deal · Rs. {totalAfterDiscount.toFixed(0)}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
