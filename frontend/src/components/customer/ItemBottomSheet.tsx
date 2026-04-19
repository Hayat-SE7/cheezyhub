'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Check, X, ShoppingCart } from 'lucide-react';
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

interface MenuItem {
  id:             string;
  name:           string;
  description?:   string;
  basePrice:      number;
  imageUrl?:      string;
  isAvailable:    boolean;
  modifierGroups: ModifierGroup[];
}

interface Props {
  item:    MenuItem | null;
  isOpen:  boolean;
  onClose: () => void;
}

function getItemEmoji(name: string) {
  const n = name.toLowerCase();
  if (n.includes('pizza'))    return '🍕';
  if (n.includes('burger'))   return '🍔';
  if (n.includes('pasta'))    return '🍝';
  if (n.includes('salad'))    return '🥗';
  if (n.includes('juice'))    return '🧃';
  if (n.includes('drink') || n.includes('cola') || n.includes('pepsi') || n.includes('coke')) return '🥤';
  if (n.includes('soup'))     return '🍲';
  if (n.includes('sandwich')) return '🥪';
  if (n.includes('wrap'))     return '🌯';
  if (n.includes('fries'))    return '🍟';
  if (n.includes('chicken'))  return '🍗';
  if (n.includes('shawarma')) return '🌯';
  if (n.includes('biryani'))  return '🍛';
  if (n.includes('roll'))     return '🌮';
  if (n.includes('cake') || n.includes('dessert')) return '🍰';
  if (n.includes('ice cream') || n.includes('gelato')) return '🍦';
  return '🧀';
}

export default function ItemBottomSheet({ item, isOpen, onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [qty,      setQty]      = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  // Reset state when a new item is opened
  useEffect(() => {
    if (isOpen) { setQty(1); setSelected({}); }
  }, [isOpen, item?.id]);

  if (!item) return null;

  const toggleMod = (groupId: string, modId: string, multiSelect: boolean) => {
    setSelected((prev) => {
      const curr = prev[groupId] ?? [];
      if (multiSelect) {
        return { ...prev, [groupId]: curr.includes(modId) ? curr.filter((id) => id !== modId) : [...curr, modId] };
      }
      return { ...prev, [groupId]: curr[0] === modId ? [] : [modId] };
    });
  };

  const getModifierPrice = () => {
    let extra = 0;
    for (const group of item.modifierGroups) {
      for (const mod of group.modifiers) {
        if ((selected[group.id] ?? []).includes(mod.id)) extra += mod.priceAdjustment;
      }
    }
    return extra;
  };

  const unitPrice  = item.basePrice + getModifierPrice();
  const totalPrice = unitPrice * qty;

  const handleAdd = () => {
    // Validate required groups
    const missing = item.modifierGroups.filter((g) => g.required && !(selected[g.id]?.length > 0));
    if (missing.length > 0) {
      toast.error(`Please choose ${missing[0].name}`);
      return;
    }

    const allMods      = item.modifierGroups.flatMap((g) => g.modifiers);
    const selectedMods = Object.values(selected).flat()
      .map((id) => allMods.find((m) => m.id === id)!)
      .filter(Boolean);

    addItem({
      menuItemId:        item.id,
      name:              item.name,
      imageUrl:          item.imageUrl,
      quantity:          qty,
      unitPrice,
      totalPrice,
      selectedModifiers: selectedMods.map((m) => ({ id: m.id, name: m.name, priceAdjustment: m.priceAdjustment })),
    });

    toast.success(`${item.name} added to cart!`, {
      icon: '🛒',
      style: { background: '#3d2a15', color: '#f5d38e', border: '1px solid #4a3520' },
    });
    onClose();
  };

  const emoji = getItemEmoji(item.name);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom sheet */}
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

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#3d2a15] flex items-center justify-center text-[#a07850] hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              <div className="px-5 pb-8 pt-2">
                {/* Item hero */}
                <div className="flex flex-col items-center mb-5">
                  <div className="w-28 h-28 rounded-2xl bg-[#3d2a15] flex items-center justify-center mb-4 overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-6xl">{emoji}</span>
                    )}
                  </div>
                  <h2 className="font-display font-bold text-[#f5d38e] text-xl text-center leading-snug">{item.name}</h2>
                  {item.description && (
                    <p className="text-[#a07850] text-sm text-center mt-1.5 leading-relaxed max-w-xs">{item.description}</p>
                  )}
                  <div className="mt-2 text-amber-400 font-display font-bold text-lg">
                    Rs. {item.basePrice.toFixed(0)}
                  </div>
                </div>

                {/* Modifier groups */}
                {item.modifierGroups.length > 0 && (
                  <div className="space-y-5 mb-6">
                    {item.modifierGroups.map((group) => (
                      <div key={group.id}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold text-[#f5d38e] uppercase tracking-widest">{group.name}</span>
                          {group.required && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-bold border border-amber-500/30">
                              Required
                            </span>
                          )}
                          {group.multiSelect && !group.required && (
                            <span className="text-[9px] text-[#a07850]">Pick multiple</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.modifiers.filter((m) => m.isAvailable).map((mod) => {
                            const isSelected = (selected[group.id] ?? []).includes(mod.id);
                            return (
                              <button
                                key={mod.id}
                                onClick={() => toggleMod(group.id, mod.id, group.multiSelect)}
                                className={clsx(
                                  'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-all',
                                  isSelected
                                    ? 'bg-amber-500 text-[#1e1208] border-amber-500'
                                    : 'bg-[#3d2a15] text-[#a07850] border-[#4a3520] hover:border-amber-500/40'
                                )}
                              >
                                {isSelected && <Check size={11} />}
                                {mod.name}
                                {mod.priceAdjustment > 0 && (
                                  <span className={clsx('text-[11px]', isSelected ? 'text-amber-100' : 'text-amber-500/60')}>
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

                {/* Divider */}
                <div className="border-t border-[#3d2a15] my-5" />

                {/* Qty + Add */}
                <div className="flex items-center gap-4">
                  {/* Qty stepper */}
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

                  {/* Add to cart */}
                  <button
                    onClick={handleAdd}
                    className="flex-1 flex items-center justify-center gap-2.5 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-display font-bold text-sm shadow-lg shadow-amber-500/30 transition-all"
                  >
                    <ShoppingCart size={16} />
                    Add to Cart · Rs. {totalPrice.toFixed(0)}
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
