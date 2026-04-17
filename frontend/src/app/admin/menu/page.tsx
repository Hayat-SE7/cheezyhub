'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { menuApi, kitchenApi } from '@/lib/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, X, Upload, ImagePlus,
  ChevronDown, ChevronRight, ChevronUp,
  FolderPlus, Settings2, GripVertical,
  AlertCircle, Check, Package, DollarSign,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────

interface Modifier {
  id?: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
}

interface ModifierGroup {
  id?: string;
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
  sortOrder: number;
  categoryId: string;
  modifierGroups: ModifierGroup[];
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
  _count?: { items: number };
}

// ─── Defaults ────────────────────────────────────────

const EMPTY_MODIFIER = (): Modifier => ({
  name: '', priceAdjustment: 0, isAvailable: true,
});

const EMPTY_GROUP = (): ModifierGroup => ({
  name: '', required: false, multiSelect: false,
  modifiers: [EMPTY_MODIFIER()],
});

const EMPTY_ITEM = (categoryId = ''): Omit<MenuItem, 'id'> => ({
  name: '', description: '', basePrice: 0, imageUrl: '',
  isAvailable: true, sortOrder: 0, categoryId,
  modifierGroups: [],
});

// ─── Emoji fallback by keyword ────────────────────────

const ITEM_EMOJI = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('pizza'))    return '🍕';
  if (n.includes('burger'))   return '🍔';
  if (n.includes('sandwich')) return '🥪';
  if (n.includes('pasta') || n.includes('noodle')) return '🍝';
  if (n.includes('salad'))    return '🥗';
  if (n.includes('soup'))     return '🍲';
  if (n.includes('juice') || n.includes('lemon')) return '🧃';
  if (n.includes('coffee'))   return '☕';
  if (n.includes('shake') || n.includes('milkshake')) return '🥤';
  if (n.includes('drink') || n.includes('soda') || n.includes('cola')) return '🥤';
  if (n.includes('ice'))      return '🍦';
  if (n.includes('cake') || n.includes('dessert')) return '🎂';
  if (n.includes('fries') || n.includes('chips')) return '🍟';
  if (n.includes('wings') || n.includes('chicken')) return '🍗';
  if (n.includes('rice'))     return '🍚';
  if (n.includes('wrap') || n.includes('taco')) return '🌮';
  return '🧀';
};

// ─── Image Upload Component ────────────────────────

function ImageUpload({
  value, onChange
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = value;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('Max 3MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block text-xs font-bold text-[#4a4a58] uppercase tracking-wider mb-2">
        Item Image
      </label>
      <div
        className="relative h-36 rounded-2xl border-2 border-dashed border-[#2a2a30] flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500/50 transition-all group"
        onClick={() => fileRef.current?.click()}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover rounded-2xl" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
              <div className="text-white text-xs font-semibold flex items-center gap-2">
                <Upload size={13} /> Replace Image
              </div>
            </div>
          </>
        ) : (
          <div className="text-center pointer-events-none">
            <ImagePlus size={28} className="mx-auto text-[#3a3a48] mb-2" />
            <p className="text-[#3a3a48] text-sm font-medium">Upload Photo</p>
            <p className="text-[#2a2a30] text-[11px] mt-1">PNG, JPG · Max 3MB</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <div className="flex gap-2 mt-2">
        <input
          className="flex-1 px-3 py-2 rounded-xl bg-[#0f0f11] border border-[#222228] text-[#f2f2f5] text-xs placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40"
          placeholder="…or paste image URL"
          value={preview?.startsWith('data:') ? '' : preview}
          onChange={(e) => onChange(e.target.value)}
        />
        {preview && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="px-3 py-2 rounded-xl text-red-400 text-xs border border-red-500/20 hover:bg-red-500/10 transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modifier Group Builder ────────────────────────

function ModifierGroupBuilder({
  groups,
  onChange,
}: {
  groups: ModifierGroup[];
  onChange: (groups: ModifierGroup[]) => void;
}) {
  const updateGroup = (gi: number, patch: Partial<ModifierGroup>) => {
    onChange(groups.map((g, i) => i === gi ? { ...g, ...patch } : g));
  };

  const removeGroup = (gi: number) => {
    onChange(groups.filter((_, i) => i !== gi));
  };

  const addMod = (gi: number) => {
    const updated = groups.map((g, i) =>
      i === gi ? { ...g, modifiers: [...g.modifiers, EMPTY_MODIFIER()] } : g
    );
    onChange(updated);
  };

  const updateMod = (gi: number, mi: number, patch: Partial<Modifier>) => {
    onChange(groups.map((g, i) =>
      i === gi
        ? { ...g, modifiers: g.modifiers.map((m, j) => j === mi ? { ...m, ...patch } : m) }
        : g
    ));
  };

  const removeMod = (gi: number, mi: number) => {
    onChange(groups.map((g, i) =>
      i === gi ? { ...g, modifiers: g.modifiers.filter((_, j) => j !== mi) } : g
    ));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-bold text-[#4a4a58] uppercase tracking-wider">
          Modifier Groups ({groups.length})
        </label>
        <button
          type="button"
          onClick={() => onChange([...groups, EMPTY_GROUP()])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[11px] font-bold hover:bg-amber-500/25 transition-colors"
        >
          <Plus size={11} /> Add Group
        </button>
      </div>

      {groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#222228] p-5 text-center">
          <p className="text-[#3a3a48] text-xs">No modifier groups yet</p>
          <p className="text-[#2a2a30] text-[11px] mt-0.5">e.g. Size, Extras, Sauce, Toppings</p>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group, gi) => (
          <div key={gi} className="rounded-2xl bg-[#0a0a0b] border border-[#1e1e22] overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-2 p-3 bg-[#111113] border-b border-[#1e1e22]">
              <GripVertical size={13} className="text-[#3a3a48] flex-shrink-0" />
              <input
                className="flex-1 bg-transparent text-[#d4d4dc] text-sm font-semibold placeholder:text-[#3a3a48] outline-none"
                placeholder="Group name (e.g. Size, Sauce)"
                value={group.name}
                onChange={(e) => updateGroup(gi, { name: e.target.value })}
              />
              {/* Required toggle */}
              <button
                type="button"
                onClick={() => updateGroup(gi, { required: !group.required })}
                className={clsx(
                  'text-[10px] px-2 py-1 rounded-lg font-bold border transition-all flex-shrink-0',
                  group.required
                    ? 'bg-red-500/15 text-red-400 border-red-500/25'
                    : 'bg-[#1e1e22] text-[#4a4a58] border-[#2a2a30] hover:border-[#3a3a40]'
                )}
                title={group.required ? 'Required (click to make optional)' : 'Optional (click to make required)'}
              >
                {group.required ? '★ Required' : '☆ Optional'}
              </button>
              {/* Multi-select toggle */}
              <button
                type="button"
                onClick={() => updateGroup(gi, { multiSelect: !group.multiSelect })}
                className={clsx(
                  'text-[10px] px-2 py-1 rounded-lg font-bold border transition-all flex-shrink-0',
                  group.multiSelect
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                    : 'bg-[#1e1e22] text-[#4a4a58] border-[#2a2a30] hover:border-[#3a3a40]'
                )}
                title={group.multiSelect ? 'Multi-select' : 'Single-select'}
              >
                {group.multiSelect ? '⊡ Multi' : '⊙ Single'}
              </button>
              <button
                type="button"
                onClick={() => removeGroup(gi)}
                className="p-1.5 rounded-lg text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
              >
                <X size={13} />
              </button>
            </div>

            {/* Modifiers */}
            <div className="p-3 space-y-2">
              {group.modifiers.map((mod, mi) => (
                <div key={mi} className="flex items-center gap-2">
                  <input
                    className="flex-1 px-3 py-2 rounded-lg bg-[#111113] border border-[#222228] text-[#d4d4dc] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/30"
                    placeholder="Option name (e.g. Large, Extra Cheese)"
                    value={mod.name}
                    onChange={(e) => updateMod(gi, mi, { name: e.target.value })}
                  />
                  <div className="relative w-24">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a4a58] text-xs">+$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      className="w-full pl-7 pr-2 py-2 rounded-lg bg-[#111113] border border-[#222228] text-[#d4d4dc] text-sm outline-none focus:border-amber-500/30"
                      placeholder="0.00"
                      value={mod.priceAdjustment || ''}
                      onChange={(e) => updateMod(gi, mi, { priceAdjustment: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMod(gi, mi)}
                    disabled={group.modifiers.length <= 1}
                    className="p-2 rounded-lg text-[#3a3a48] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 transition-all flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addMod(gi)}
                className="w-full py-2 rounded-lg border border-dashed border-[#2a2a30] text-[#4a4a58] text-[11px] font-semibold hover:border-amber-500/30 hover:text-amber-500/70 transition-all"
              >
                + Add Option
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Item Form Panel (slide-in) ────────────────────

interface FormState {
  name:           string;
  description:    string;
  basePrice:      number | '';
  imageUrl:       string;
  categoryId:     string;
  isAvailable:    boolean;
  modifierGroups: ModifierGroup[];
}

function ItemFormPanel({
  editItem,
  categories,
  onSave,
  onClose,
}: {
  editItem: MenuItem | null;
  categories: Category[];
  onSave: (item: MenuItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    editItem
      ? {
          name:           editItem.name,
          description:    editItem.description ?? '',
          basePrice:      editItem.basePrice,
          imageUrl:       editItem.imageUrl ?? '',
          categoryId:     editItem.categoryId,
          isAvailable:    editItem.isAvailable,
          modifierGroups: editItem.modifierGroups ?? [],
        }
      : {
          name: '', description: '', basePrice: '',
          imageUrl: '', categoryId: categories[0]?.id ?? '',
          isAvailable: true, modifierGroups: [],
        }
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'modifiers'>('basic');

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    if (form.basePrice === '' || isNaN(Number(form.basePrice))) { toast.error('Valid price required'); return; }
    if (!form.categoryId) { toast.error('Select a category'); return; }

    // Validate modifier groups
    for (const g of form.modifierGroups) {
      if (!g.name.trim()) { toast.error('All modifier groups need a name'); return; }
      for (const m of g.modifiers) {
        if (!m.name.trim()) { toast.error('All modifier options need a name'); return; }
      }
    }

    setSaving(true);
    try {
      const payload = {
        name:           form.name.trim(),
        description:    form.description.trim() || undefined,
        basePrice:      Number(form.basePrice),
        imageUrl:       form.imageUrl || null,
        categoryId:     form.categoryId,
        isAvailable:    form.isAvailable,
        modifierGroups: form.modifierGroups.map((g) => ({
          name:        g.name,
          required:    g.required,
          multiSelect: g.multiSelect,
          modifiers:   g.modifiers.map((m) => ({
            name:            m.name,
            priceAdjustment: m.priceAdjustment,
            isAvailable:     true,
          })),
        })),
      };

      let savedItem: MenuItem;
      if (editItem) {
        const res = await menuApi.updateItem(editItem.id, payload);
        savedItem = res.data.data;
        toast.success(`"${savedItem.name}" updated!`);
      } else {
        const res = await menuApi.createItem(payload);
        savedItem = res.data.data;
        toast.success(`"${savedItem.name}" created!`);
      }
      onSave(savedItem);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const totalModCount = form.modifierGroups.reduce((s, g) => s + g.modifiers.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-[#0c0c0e] border-l border-[#1e1e22] h-full flex flex-col animate-slide-up overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e22] bg-[#0f0f11] flex-shrink-0">
          <div>
            <h2 className="font-display font-black text-[#f2f2f5] text-lg leading-tight">
              {editItem ? 'Edit Item' : 'New Menu Item'}
            </h2>
            <p className="text-[#4a4a58] text-xs mt-0.5">
              {editItem ? `Editing "${editItem.name}"` : 'Fill in the details below'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-[#4a4a58] hover:text-[#f2f2f5] hover:bg-[#1e1e22] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#1e1e22] flex-shrink-0 bg-[#0f0f11]">
          {[
            { key: 'basic',     label: 'Item Details',  badge: null },
            { key: 'modifiers', label: 'Modifiers',     badge: form.modifierGroups.length > 0 ? String(form.modifierGroups.length) : null },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={clsx(
                'flex-1 py-3 text-sm font-display font-bold flex items-center justify-center gap-2 border-b-2 transition-all',
                activeTab === t.key
                  ? 'text-amber-400 border-amber-500'
                  : 'text-[#4a4a58] border-transparent hover:text-[#9898a5]'
              )}
            >
              {t.label}
              {t.badge && (
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'basic' && (
            <div className="space-y-5">
              {/* Image upload */}
              <ImageUpload
                value={form.imageUrl}
                onChange={(url) => update({ imageUrl: url })}
              />

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-[#4a4a58] uppercase tracking-wider mb-2">
                  Item Name <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 transition-colors"
                  placeholder="e.g. Classic Cheezeburger"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#4a4a58] uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 resize-none transition-colors leading-relaxed"
                  rows={3}
                  placeholder="Short description for customers (max 500 chars)"
                  maxLength={500}
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
                <div className="text-right text-[10px] text-[#3a3a48] mt-1">
                  {form.description.length}/500
                </div>
              </div>

              {/* Price + Category row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4a4a58] uppercase tracking-wider mb-2">
                    Base Price <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a4a58] text-sm font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      className="w-full pl-7 pr-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none focus:border-amber-500/40 transition-colors"
                      placeholder="0.00"
                      value={form.basePrice}
                      onChange={(e) => update({ basePrice: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#4a4a58] uppercase tracking-wider mb-2">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none focus:border-amber-500/40 transition-colors"
                    value={form.categoryId}
                    onChange={(e) => update({ categoryId: e.target.value })}
                  >
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Available toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#111113] border border-[#222228]">
                <div>
                  <div className="font-semibold text-[#f2f2f5] text-sm">Available to Customers</div>
                  <div className="text-[#4a4a58] text-xs mt-0.5">Turn off to temporarily hide from menu</div>
                </div>
                <button
                  type="button"
                  onClick={() => update({ isAvailable: !form.isAvailable })}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${form.isAvailable ? 'bg-emerald-500' : 'bg-[#2a2a30]'}`}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ left: form.isAvailable ? '26px' : '2px' }}
                  />
                </button>
              </div>

              {/* Modifier teaser */}
              <button
                type="button"
                onClick={() => setActiveTab('modifiers')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#111113] border border-[#1e1e22] hover:border-amber-500/25 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <Settings2 size={14} className="text-amber-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-[#d4d4dc]">Modifier Groups</div>
                    <div className="text-[11px] text-[#4a4a58]">
                      {form.modifierGroups.length === 0
                        ? 'Add size, extras, sauces...'
                        : `${form.modifierGroups.length} group${form.modifierGroups.length !== 1 ? 's' : ''} · ${totalModCount} option${totalModCount !== 1 ? 's' : ''}`
                      }
                    </div>
                  </div>
                </div>
                <ChevronRight size={15} className="text-[#4a4a58] group-hover:text-amber-400 transition-colors" />
              </button>
            </div>
          )}

          {activeTab === 'modifiers' && (
            <ModifierGroupBuilder
              groups={form.modifierGroups}
              onChange={(groups) => update({ modifierGroups: groups })}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-[#1e1e22] bg-[#0f0f11]">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-[#222228] text-[#6a6a78] text-sm font-semibold hover:border-[#333340] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-display font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <>
                  <Check size={15} />
                  {editItem ? 'Save Changes' : 'Create Item'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Category Modal ────────────────────────────────

function CategoryModal({
  categories,
  onClose,
  onRefresh,
}: {
  categories: Category[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [name, setName]         = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing]   = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await menuApi.createCategory({ name: name.trim(), sortOrder: categories.length });
      setName('');
      onRefresh();
      toast.success(`Category "${name.trim()}" created!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (cat: Category) => {
    if (!editName.trim() || editName === cat.name) { setEditing(null); return; }
    try {
      await menuApi.updateCategory(cat.id, { name: editName.trim() });
      onRefresh();
      toast.success('Category renamed');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed');
    }
    setEditing(null);
  };

  const handleDelete = async (cat: Category) => {
    const count = cat._count?.items ?? cat.items?.length ?? 0;
    if (count > 0) {
      toast.error(`Move or delete the ${count} items in "${cat.name}" first`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await menuApi.deleteCategory(cat.id);
      onRefresh();
      toast.success('Category deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Cannot delete');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-[#111113] rounded-3xl border border-[#222228] overflow-hidden animate-scale-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e22]">
          <h2 className="font-display font-bold text-[#f2f2f5] text-base">Manage Categories</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-[#4a4a58] hover:text-[#f2f2f5] hover:bg-[#1e1e22] transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Add category */}
        <div className="px-6 py-4 border-b border-[#1a1a1e]">
          <div className="flex gap-2">
            <input
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#0f0f11] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40"
              placeholder="New category name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="btn-press px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold transition-colors"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Categories list */}
        <div className="max-h-80 overflow-y-auto px-3 py-3">
          {categories.length === 0 && (
            <p className="text-center text-[#3a3a48] text-sm py-8">No categories yet</p>
          )}
          {categories.map((cat) => {
            const count = cat._count?.items ?? cat.items?.length ?? 0;
            return (
              <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#1a1a1e] group transition-colors">
                <GripVertical size={13} className="text-[#2a2a30]" />

                {editing === cat.id ? (
                  <input
                    autoFocus
                    className="flex-1 bg-[#0f0f11] border border-amber-500/40 rounded-lg px-3 py-1 text-[#f2f2f5] text-sm outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRename(cat)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(cat);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                ) : (
                  <div className="flex-1">
                    <span className="text-[#d4d4dc] text-sm font-medium">{cat.name}</span>
                    <span className="text-[#3a3a48] text-[11px] ml-2">{count} item{count !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {editing !== cat.id && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditing(cat.id); setEditName(cat.name); }}
                      className="p-1.5 rounded-lg text-[#4a4a58] hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-lg text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-[#1a1a1e]">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-[#222228] text-[#6a6a78] text-sm font-semibold hover:border-[#333340] transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function AdminMenuPage() {
  const [categories,     setCategories]     = useState<Category[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [showForm,       setShowForm]       = useState(false);
  const [editItem,       setEditItem]       = useState<MenuItem | null>(null);
  const [showCatModal,   setShowCatModal]   = useState(false);
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set());
  const [deleting,       setDeleting]       = useState<string | null>(null);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await menuApi.getAll();
      setCategories(res.data.data);
      if (!activeCategory && res.data.data.length > 0) {
        setActiveCategory(res.data.data[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => { fetchMenu(); }, []);

  // ── Stats ──────────────────────────────────────────
  const totalItems    = categories.reduce((s, c) => s + (c.items?.length ?? 0), 0);
  const withImages    = categories.reduce((s, c) => s + (c.items?.filter((i) => i.imageUrl)?.length ?? 0), 0);
  const unavailable   = categories.reduce((s, c) => s + (c.items?.filter((i) => !i.isAvailable)?.length ?? 0), 0);
  const withModifiers = categories.reduce((s, c) => s + (c.items?.filter((i) => i.modifierGroups?.length > 0)?.length ?? 0), 0);

  // ── Active category items ──────────────────────────
  const activeItems = categories.find((c) => c.id === activeCategory)?.items ?? [];

  // ── Availability toggles ───────────────────────────
  const toggleItem = async (item: MenuItem) => {
    const newVal = !item.isAvailable;
    setCategories((cats) =>
      cats.map((cat) => ({
        ...cat,
        items: cat.items?.map((i) => i.id === item.id ? { ...i, isAvailable: newVal } : i) ?? [],
      }))
    );
    try {
      await menuApi.setItemAvailability(item.id, newVal);
      toast.success(`"${item.name}" ${newVal ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update');
      setCategories((cats) =>
        cats.map((cat) => ({
          ...cat,
          items: cat.items?.map((i) => i.id === item.id ? { ...i, isAvailable: !newVal } : i) ?? [],
        }))
      );
    }
  };

  const toggleModifier = async (itemId: string, mod: { id: string; name: string; isAvailable: boolean }) => {
    const newVal = !mod.isAvailable;
    setCategories((cats) =>
      cats.map((cat) => ({
        ...cat,
        items: cat.items?.map((item) =>
          item.id === itemId
            ? {
                ...item,
                modifierGroups: item.modifierGroups?.map((g) => ({
                  ...g,
                  modifiers: g.modifiers?.map((m) => m.id === mod.id ? { ...m, isAvailable: newVal } : m) ?? [],
                })) ?? [],
              }
            : item
        ) ?? [],
      }))
    );
    try {
      await menuApi.setModifierAvailability(mod.id!, newVal);
    } catch {
      toast.error('Failed to update modifier');
    }
  };

  // ── Delete item ────────────────────────────────────
  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeleting(item.id);
    try {
      await menuApi.deleteItem(item.id);
      setCategories((cats) =>
        cats.map((cat) => ({
          ...cat,
          items: cat.items?.filter((i) => i.id !== item.id) ?? [],
        }))
      );
      toast.success(`"${item.name}" deleted`);
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setDeleting(null);
    }
  };

  // ── Form callbacks ─────────────────────────────────
  const handleSaved = (savedItem: MenuItem) => {
    setCategories((cats) =>
      cats.map((cat) => {
        const exists = cat.items?.some((i) => i.id === savedItem.id);
        const filteredItems = cat.items?.filter((i) => i.id !== savedItem.id) ?? [];

        if (cat.id === savedItem.categoryId) {
          return {
            ...cat,
            items: exists
              ? cat.items.map((i) => (i.id === savedItem.id ? savedItem : i))
              : [...filteredItems, savedItem],
          };
        }
        // Item moved to different category — remove from old
        return { ...cat, items: filteredItems };
      })
    );
    setShowForm(false);
    setEditItem(null);
    // Auto-navigate to the saved item's category
    setActiveCategory(savedItem.categoryId);
  };

  const openCreate = () => {
    setEditItem(null);
    setShowForm(true);
  };

  const openEdit = async (item: MenuItem) => {
    try {
      // Fetch full item with modifiers
      const res = await menuApi.getItem(item.id);
      setEditItem(res.data.data);
      setShowForm(true);
    } catch {
      // Fallback to local data
      setEditItem(item);
      setShowForm(true);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* ── Top bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1e]">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Menu Management</h1>
          <div className="flex items-center gap-3 mt-1 text-[11px]">
            <span className="text-[#4a4a58]">{totalItems} items</span>
            <span className="text-blue-400/70">·</span>
            <span className="text-blue-400">{withImages} with images</span>
            <span className="text-blue-400/70">·</span>
            <span className="text-purple-400">{withModifiers} with modifiers</span>
            {unavailable > 0 && (
              <>
                <span className="text-blue-400/70">·</span>
                <span className="text-red-400">{unavailable} unavailable</span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowCatModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#222228] text-[#9898a5] text-sm font-semibold hover:border-[#333340] hover:text-[#f2f2f5] transition-all"
          >
            <FolderPlus size={15} /> Categories
          </button>
          <button
            onClick={openCreate}
            className="btn-press flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-display font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
          >
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Category sidebar ──────────────────────── */}
          <div className="w-52 border-r border-[#1a1a1e] overflow-y-auto flex-shrink-0 py-3">
            <div className="px-3 mb-2">
              <span className="text-[10px] font-bold text-[#3a3a48] uppercase tracking-widest">Categories</span>
            </div>
            {categories.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[#3a3a48] text-xs">No categories</p>
                <button
                  onClick={() => setShowCatModal(true)}
                  className="mt-3 text-amber-500 text-xs font-semibold"
                >
                  + Add one
                </button>
              </div>
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={clsx(
                    'w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-medium transition-all rounded-xl mx-1',
                    cat.id === activeCategory
                      ? 'bg-amber-500/15 text-amber-400 font-semibold'
                      : 'text-[#6a6a78] hover:text-[#d4d4dc] hover:bg-[#1a1a1e]'
                  )}
                >
                  <span className="truncate">{cat.name}</span>
                  <span className={clsx(
                    'text-[11px] ml-2 flex-shrink-0 px-1.5 py-0.5 rounded-full',
                    cat.id === activeCategory ? 'bg-amber-500/20 text-amber-400' : 'text-[#3a3a48]'
                  )}>
                    {cat.items?.length ?? 0}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* ── Items list ────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Empty state */}
            {categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="text-6xl mb-4">🧀</div>
                <h2 className="font-display font-bold text-[#f2f2f5] text-xl">Set up your menu</h2>
                <p className="text-[#4a4a58] text-sm mt-2 mb-6">Start by creating categories, then add your items</p>
                <button
                  onClick={() => setShowCatModal(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-xl font-display font-bold text-sm"
                >
                  <FolderPlus size={15} /> Create First Category
                </button>
              </div>
            ) : activeItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Package size={36} className="text-[#2a2a30] mb-3" />
                <div className="font-display font-bold text-[#3a3a48]">No items in this category</div>
                <button
                  onClick={openCreate}
                  className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-xl text-sm font-bold"
                >
                  <Plus size={14} /> Add First Item
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Category header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-display font-bold text-[#f2f2f5] text-lg">
                    {categories.find((c) => c.id === activeCategory)?.name}
                  </h2>
                  <div className="h-px flex-1 bg-[#1e1e22]" />
                  <span className="text-[11px] text-[#3a3a48]">{activeItems.length} items</span>
                </div>

                {activeItems.map((item) => {
                  const isExpanded = expanded.has(item.id);
                  const hasModifiers = item.modifierGroups?.length > 0;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-[#0f0f11] border border-[#1e1e22] overflow-hidden animate-fade-in"
                    >
                      {/* Item row */}
                      <div className="flex items-center gap-3 p-3.5">
                        {/* Expand toggle */}
                        <button
                          onClick={() => hasModifiers && toggleExpand(item.id)}
                          className={clsx(
                            'flex-shrink-0 text-[#3a3a48] transition-colors',
                            hasModifiers ? 'hover:text-[#9898a5] cursor-pointer' : 'opacity-0 pointer-events-none'
                          )}
                        >
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>

                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-[#1a1a1e] flex items-center justify-center">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.name} width={48} height={48} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">{ITEM_EMOJI(item.name)}</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className={clsx(
                            'font-semibold text-sm',
                            item.isAvailable ? 'text-[#d4d4dc]' : 'text-[#4a4a58] line-through'
                          )}>
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-display font-bold text-amber-400 text-sm">
                              ${item.basePrice.toFixed(2)}
                            </span>
                            {item.description && (
                              <span className="text-[11px] text-[#4a4a58] truncate max-w-[200px]">
                                {item.description}
                              </span>
                            )}
                            {hasModifiers && (
                              <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                                {item.modifierGroups.length} mod group{item.modifierGroups.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Edit */}
                          <button
                            onClick={() => openEdit(item)}
                            className="p-2 rounded-xl text-[#4a4a58] hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                            title="Edit item"
                          >
                            <Pencil size={14} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={deleting === item.id}
                            className="p-2 rounded-xl text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                            title="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>

                          {/* Availability toggle */}
                          <button
                            onClick={() => toggleItem(item)}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${item.isAvailable ? 'bg-emerald-500' : 'bg-[#2a2a30]'}`}
                            title={item.isAvailable ? 'Click to disable' : 'Click to enable'}
                          >
                            <div
                              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                              style={{ left: item.isAvailable ? '22px' : '2px' }}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Expanded modifier list */}
                      {isExpanded && hasModifiers && (
                        <div className="bg-[#080809] px-5 py-4 border-t border-[#1a1a1e] animate-fade-in">
                          {item.modifierGroups.map((group) => (
                            <div key={group.id} className="mb-3 last:mb-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[11px] text-[#4a4a58] font-bold uppercase tracking-wider">
                                  {group.name}
                                </span>
                                {group.required && (
                                  <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full font-bold">Required</span>
                                )}
                                {group.multiSelect && (
                                  <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full font-bold">Multi</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.modifiers?.map((mod) => (
                                  <button
                                    key={mod.id}
                                    onClick={() => mod.id && toggleModifier(item.id, { id: mod.id, name: mod.name, isAvailable: mod.isAvailable })}
                                    className={clsx(
                                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all',
                                      mod.isAvailable
                                        ? 'bg-[#1e1e22] text-[#9898a5] border-[#2a2a30] hover:border-emerald-500/40'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    )}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${mod.isAvailable ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    {mod.name}
                                    {mod.priceAdjustment > 0 && (
                                      <span className="opacity-50">+${mod.priceAdjustment.toFixed(2)}</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => openEdit(item)}
                            className="mt-3 text-[11px] text-amber-500/70 hover:text-amber-400 flex items-center gap-1 transition-colors"
                          >
                            <Pencil size={10} /> Edit modifier groups
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Form panel ──────────────────────────────── */}
      {showForm && (
        <ItemFormPanel
          editItem={editItem}
          categories={categories}
          onSave={handleSaved}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}

      {/* ── Category modal ───────────────────────────── */}
      {showCatModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowCatModal(false)}
          onRefresh={fetchMenu}
        />
      )}
    </div>
  );
}
