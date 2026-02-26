'use client';

import { useEffect, useState, useCallback } from 'react';
import { modifierGroupApi } from '@/lib/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Plus, X, Pencil, Trash2, Check, SlidersHorizontal,
  ChevronDown, ChevronRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────

interface Modifier {
  id?: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  sortOrder: number;
  modifiers: Modifier[];
  _count?: { menuItems: number };
}

// ─── Empty helpers ────────────────────────────────────

const EMPTY_MOD  = (): Modifier => ({ name: '', priceAdjustment: 0, isAvailable: true });
const EMPTY_GROUP = () => ({
  name: '', required: false, multiSelect: false, sortOrder: 0,
  modifiers: [EMPTY_MOD()],
});

// ─── Group Form (create / edit) ───────────────────────

function GroupForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ModifierGroup;
  onSave: (group: ModifierGroup) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? { name: initial.name, required: initial.required, multiSelect: initial.multiSelect, modifiers: initial.modifiers }
      : EMPTY_GROUP()
  );
  const [saving, setSaving] = useState(false);

  const updateMod = (i: number, patch: Partial<Modifier>) =>
    setForm((f) => ({ ...f, modifiers: f.modifiers.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  const removeMod = (i: number) =>
    setForm((f) => ({ ...f, modifiers: f.modifiers.filter((_, j) => j !== i) }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Group name required'); return; }
    for (const m of form.modifiers) {
      if (!m.name.trim()) { toast.error('All option names required'); return; }
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        required: form.required,
        multiSelect: form.multiSelect,
        modifiers: form.modifiers.map((m, i) => ({
          name: m.name.trim(),
          priceAdjustment: m.priceAdjustment,
          isAvailable: true,
          sortOrder: i,
        })),
      };
      let saved: ModifierGroup;
      if (initial?.id) {
        const res = await modifierGroupApi.update(initial.id, payload);
        saved = res.data.data;
        toast.success(`"${saved.name}" updated`);
      } else {
        const res = await modifierGroupApi.create(payload);
        saved = res.data.data;
        toast.success(`"${saved.name}" created`);
      }
      onSave(saved);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#0c0c0e] border-l border-[#1e1e22] h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e22] bg-[#0f0f11] flex-shrink-0">
          <div>
            <h2 className="font-display font-black text-[#f2f2f5] text-lg">
              {initial ? 'Edit Modifier Group' : 'New Modifier Group'}
            </h2>
            <p className="text-[#4a4a58] text-xs mt-0.5">e.g. Size, Toppings, Sauce</p>
          </div>
          <button onClick={onCancel} className="p-2.5 rounded-xl text-[#4a4a58] hover:text-[#f2f2f5] hover:bg-[#1e1e22] transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Group name */}
          <div>
            <label className="block text-xs font-bold text-[#4a4a58] uppercase tracking-wider mb-2">Group Name *</label>
            <input
              className="w-full px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40"
              placeholder="e.g. Pizza Size, Sauce Choice, Toppings"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, required: !f.required }))}
              className={clsx(
                'flex items-center justify-between p-3.5 rounded-xl border transition-all text-sm font-semibold',
                form.required
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-[#111113] border-[#222228] text-[#4a4a58] hover:border-[#333340]'
              )}
            >
              <span>Required</span>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${form.required ? 'bg-red-500' : 'bg-[#2a2a30]'}`}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.required ? '18px' : '2px' }} />
              </div>
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, multiSelect: !f.multiSelect }))}
              className={clsx(
                'flex items-center justify-between p-3.5 rounded-xl border transition-all text-sm font-semibold',
                form.multiSelect
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-[#111113] border-[#222228] text-[#4a4a58] hover:border-[#333340]'
              )}
            >
              <span>Multi-select</span>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${form.multiSelect ? 'bg-blue-500' : 'bg-[#2a2a30]'}`}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.multiSelect ? '18px' : '2px' }} />
              </div>
            </button>
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-[#4a4a58] uppercase tracking-wider">Options</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, modifiers: [...f.modifiers, EMPTY_MOD()] }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[11px] font-bold hover:bg-amber-500/25 transition-colors"
              >
                <Plus size={11} /> Add Option
              </button>
            </div>
            <div className="space-y-2">
              {form.modifiers.map((mod, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#111113] border border-[#222228] text-[#d4d4dc] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/30"
                    placeholder="Option name (e.g. Large, Extra Cheese)"
                    value={mod.name}
                    onChange={(e) => updateMod(i, { name: e.target.value })}
                  />
                  <div className="relative w-24">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a4a58] text-xs">+$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      className="w-full pl-7 pr-2 py-2.5 rounded-lg bg-[#111113] border border-[#222228] text-[#d4d4dc] text-sm outline-none focus:border-amber-500/30"
                      placeholder="0.00"
                      value={mod.priceAdjustment || ''}
                      onChange={(e) => updateMod(i, { priceAdjustment: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={form.modifiers.length <= 1}
                    onClick={() => removeMod(i)}
                    className="p-2 rounded-lg text-[#3a3a48] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-[#1e1e22] bg-[#0f0f11] flex gap-3">
          <button
            onClick={onCancel}
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
              <><Check size={15} /> {initial ? 'Save Changes' : 'Create Group'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function AdminModifiersPage() {
  const [groups,    setGroups]    = useState<ModifierGroup[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editGroup, setEditGroup] = useState<ModifierGroup | null>(null);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await modifierGroupApi.getAll();
      setGroups(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, []);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleDelete = async (group: ModifierGroup) => {
    const count = group._count?.menuItems ?? 0;
    if (count > 0) {
      toast.error(`Remove this group from ${count} item${count !== 1 ? 's' : ''} first`);
      return;
    }
    if (!confirm(`Delete "${group.name}"?`)) return;
    setDeleting(group.id);
    try {
      await modifierGroupApi.remove(group.id);
      setGroups((g) => g.filter((x) => x.id !== group.id));
      toast.success(`"${group.name}" deleted`);
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handleSaved = (saved: ModifierGroup) => {
    setGroups((prev) => {
      const exists = prev.find((g) => g.id === saved.id);
      return exists ? prev.map((g) => (g.id === saved.id ? saved : g)) : [...prev, saved];
    });
    setShowForm(false);
    setEditGroup(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1e]">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Modifier Groups</h1>
          <p className="text-[#4a4a58] text-xs mt-0.5">
            Create reusable groups (Size, Toppings, Sauce) — attach them to any menu item
          </p>
        </div>
        <button
          onClick={() => { setEditGroup(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-display font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
        >
          <Plus size={15} /> New Group
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <SlidersHorizontal size={36} className="text-[#2a2a30] mb-3" />
            <div className="font-display font-bold text-[#3a3a48]">No modifier groups yet</div>
            <p className="text-[#2a2a30] text-xs mt-1 mb-4">Create groups like "Pizza Size" or "Toppings" then attach them to menu items</p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-xl text-sm font-bold"
            >
              <Plus size={14} /> Create First Group
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 max-w-3xl">
            {groups.map((group) => {
              const isExpanded = expanded.has(group.id);
              const itemCount  = group._count?.menuItems ?? 0;
              return (
                <div key={group.id} className="rounded-2xl bg-[#0f0f11] border border-[#1e1e22] overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => toggleExpand(group.id)}
                      className="text-[#3a3a48] hover:text-[#9898a5] transition-colors flex-shrink-0"
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#d4d4dc] text-sm">{group.name}</span>
                        {group.required && (
                          <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full font-bold">Required</span>
                        )}
                        {group.multiSelect && (
                          <span className="text-[9px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-bold">Multi</span>
                        )}
                        <span className="text-[10px] text-[#3a3a48]">
                          {group.modifiers.length} option{group.modifiers.length !== 1 ? 's' : ''}
                          {itemCount > 0 && ` · used in ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditGroup(group); setShowForm(true); }}
                        className="p-2 rounded-xl text-[#4a4a58] hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                        title="Edit group"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(group)}
                        disabled={deleting === group.id}
                        className="p-2 rounded-xl text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all"
                        title="Delete group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-[#080809] px-5 py-4 border-t border-[#1a1a1e]">
                      <div className="flex flex-wrap gap-2">
                        {group.modifiers.map((mod, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e1e22] border border-[#2a2a30] text-[12px] text-[#9898a5]">
                            <span className="font-semibold">{mod.name}</span>
                            {(mod.priceAdjustment ?? 0) > 0 && (
                              <span className="text-amber-500/70">+${(mod.priceAdjustment ?? 0).toFixed(2)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form panel */}
      {showForm && (
        <GroupForm
          initial={editGroup ?? undefined}
          onSave={handleSaved}
          onCancel={() => { setShowForm(false); setEditGroup(null); }}
        />
      )}
    </div>
  );
}
