'use client';

import Image from 'next/image';
import { Plus } from 'lucide-react';
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
  item:        MenuItem;
  paused:      boolean;
  index?:      number;
  onOpenSheet: (item: MenuItem) => void;
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

export default function MenuItemCard({ item, paused, index = 0, onOpenSheet }: Props) {
  const disabled = !item.isAvailable || paused;

  const handleClick = () => {
    if (!disabled) onOpenSheet(item);
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-4 px-4 py-3.5 border-b border-[#3d2a15] transition-colors',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:bg-[#3d2a15]/50 active:bg-[#3d2a15]'
      )}
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={handleClick}
    >
      {/* Emoji / Image */}
      <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-[#3d2a15] flex items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} width={64} height={64} className="object-cover w-full h-full" loading="lazy" />
        ) : (
          <span className="text-3xl">{getItemEmoji(item.name)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className={clsx(
          'font-display font-bold text-[15px] leading-snug',
          disabled ? 'text-[#a07850] line-through' : 'text-[#f5d38e]'
        )}>
          {item.name}
        </h3>
        {item.description && (
          <p className="text-[#a07850] text-[13px] mt-0.5 line-clamp-1 leading-snug">{item.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-display font-bold text-amber-400 text-sm">Rs. {item.basePrice.toFixed(0)}</span>
          {!item.isAvailable && (
            <span className="text-[10px] px-2 py-0.5 bg-[#3d2a15] text-[#a07850] rounded-full font-semibold">Sold Out</span>
          )}
          {paused && item.isAvailable && (
            <span className="text-[10px] px-2 py-0.5 bg-[#3d2a15] text-[#a07850] rounded-full font-semibold">Paused</span>
          )}
          {item.modifierGroups.length > 0 && !disabled && (
            <span className="text-[10px] text-[#a07850]">Customizable</span>
          )}
        </div>
      </div>

      {/* Add button */}
      {!disabled && (
        <button
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/30 transition-colors"
        >
          <Plus size={18} className="text-white" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
