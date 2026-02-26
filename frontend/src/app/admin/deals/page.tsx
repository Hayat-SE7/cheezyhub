'use client';

import { useEffect, useState, useRef } from 'react';
import { dealsApi, menuApi } from '@/lib/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Image, X, Upload, Calendar, Tag, Package, Zap, Star
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

// --- DATE HELPERS ---
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const hardSafeFormat = (dateInput: any) => {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
  return isValid(date) ? format(date, 'MMM dd, yyyy') : 'Pending';
};

interface Deal {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  dealType: 'combo' | 'discount' | 'promotion' | 'featured';
  discountType: 'flat' | 'percent';
  discountValue: number;
  linkedItemIds: string[];
  validFrom: string;
  validTo?: string;
  displayLocation: 'slider' | 'deals_section' | 'both';
  isActive: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  basePrice: number;
}

const DEAL_ICONS = {
  combo:     { icon: Package, color: '#3b82f6', label: 'Combo' },
  discount:  { icon: Tag,     color: '#ef4444', label: 'Discount' },
  promotion: { icon: Zap,     color: '#8b5cf6', label: 'Promotion' },
  featured:  { icon: Star,    color: '#f59e0b', label: 'Featured' },
};

const EMPTY_FORM = {
  title: '', description: '', imageUrl: '',
  dealType: 'featured' as Deal['dealType'],
  discountType: 'flat' as Deal['discountType'],
  discountValue: 0,
  linkedItemIds: [] as string[],
  validFrom: new Date().toISOString().slice(0, 16),
  validTo: addDays(new Date(), 7).toISOString().slice(0, 16),
  displayLocation: 'both' as Deal['displayLocation'],
  isActive: true,
};

export default function AdminDealsPage() {
  const [deals,      setDeals]     = useState<Deal[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Deal | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [submitting,setSubmitting]= useState(false);
  const [imgPreview,setImgPreview]= useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDeals = async () => {
    try {
      const res = await dealsApi.getAll();
      setDeals(res.data.data);
    } catch (err) {
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
    menuApi.getAll().then((r) => {
      const items: MenuItem[] = r.data.data.flatMap((cat: any) => cat.items ?? []);
      setMenuItems(items);
    }).catch(() => toast.error("Failed to load menu items"));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setImgPreview('');
    setShowForm(true);
  };

  const openEdit = (deal: Deal) => {
    setEditing(deal);
    setForm({
      title:           deal.title,
      description:     deal.description ?? '',
      imageUrl:        deal.imageUrl ?? '',
      dealType:        deal.dealType,
      discountType:    deal.discountType,
      discountValue:   deal.discountValue,
      linkedItemIds:   deal.linkedItemIds || [],
      validFrom:       deal.validFrom ? deal.validFrom.slice(0, 16) : '',
      validTo:         deal.validTo ? deal.validTo.slice(0, 16) : '',
      displayLocation: deal.displayLocation,
      isActive:        deal.isActive,
    });
    setImgPreview(deal.imageUrl ?? '');
    setShowForm(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImgPreview(dataUrl);
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!form.title) { toast.error('Title required'); return; }
    setSubmitting(true);
    
    const payload = {
      ...form,
      discountValue: Number(form.discountValue),
      validFrom: new Date(form.validFrom).toISOString(),
      validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
    };

    try {
      if (editing) {
        await dealsApi.update(editing.id, payload);
        toast.success('Deal updated!');
      } else {
        await dealsApi.create(payload);
        toast.success('Deal created!');
      }
      setShowForm(false);
      fetchDeals();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (deal: Deal) => {
    await dealsApi.toggle(deal.id);
    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, isActive: !d.isActive } : d));
  };

  const handleDelete = async (deal: Deal) => {
    if (!confirm(`Delete "${deal.title}"?`)) return;
    await dealsApi.remove(deal.id);
    setDeals((prev) => prev.filter((d) => d.id !== deal.id));
    toast.success('Deal deleted');
  };

  const toggleItemLink = (id: string) => {
    setForm((f) => ({
      ...f,
      linkedItemIds: f.linkedItemIds.includes(id)
        ? f.linkedItemIds.filter((x) => x !== id)
        : [...f.linkedItemIds, id],
    }));
  };

  const now = new Date();
  const active   = deals.filter((d) => d.isActive);
  const inactive = deals.filter((d) => !d.isActive);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Deals</h1>
          <p className="text-[#4a4a58] text-sm mt-0.5">
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn-press flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-display font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
        >
          <Plus size={15} /> New Deal
        </button>
      </div>

      {/* Deals list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : deals.length === 0 ? (
        <div className="py-24 text-center">
          <div className="text-5xl mb-4">🎁</div>
          <h2 className="font-display font-bold text-[#f2f2f5] text-lg">No deals yet</h2>
          <p className="text-[#4a4a58] text-sm mt-1 mb-5">Create your first promotion to attract customers</p>
          <button onClick={openCreate} className="btn-press px-6 py-3 bg-amber-500 text-white rounded-xl font-display font-bold text-sm">
            Create First Deal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => {
            const typeInfo = DEAL_ICONS[deal.dealType] ?? DEAL_ICONS.featured;
            const isExpired = deal.validTo ? new Date(deal.validTo) < now : false;

            return (
              <div
                key={deal.id}
                className={clsx(
                  'flex gap-4 p-4 rounded-2xl bg-[#0f0f11] border transition-all',
                  deal.isActive && !isExpired ? 'border-[#222228]' : 'border-[#1a1a1e] opacity-60'
                )}
              >
                <div
                  className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-3xl overflow-hidden"
                  style={{ background: typeInfo.color + '15' }}
                >
                  {deal.imageUrl ? (
                    <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span>{deal.dealType === 'combo' ? '🍔' : deal.dealType === 'discount' ? '🔥' : deal.dealType === 'promotion' ? '✨' : '⭐'}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-[#f2f2f5] text-sm">{deal.title}</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: typeInfo.color + '20', color: typeInfo.color }}
                      >
                        {deal.dealType}
                      </span>
                      {isExpired && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Expired</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(deal)} className="p-1.5 rounded-lg text-[#4a4a58] hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleToggle(deal)} className="p-1.5 rounded-lg text-[#4a4a58] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                        {deal.isActive ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => handleDelete(deal)} className="p-1.5 rounded-lg text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {deal.description && (
                    <p className="text-[#6a6a78] text-xs mt-1 line-clamp-1">{deal.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-[#4a4a58]">
                    {deal.discountValue > 0 && (
                      <span className="text-amber-400 font-bold">
                        {deal.discountType === 'percent' ? `${deal.discountValue}% OFF` : `$${deal.discountValue} OFF`}
                      </span>
                    )}
                    <span className="capitalize">{deal.displayLocation.replace('_', ' ')}</span>
                    {deal.validTo && (
                      <span className="flex items-center gap-1">
                        <Calendar size={9} />
                        Ends {hardSafeFormat(deal.validTo)}
                      </span>
                    )}
                    {deal.linkedItemIds?.length > 0 && (
                      <span>{deal.linkedItemIds.length} linked item{deal.linkedItemIds.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-end overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0f0f11] border-l border-[#222228] min-h-screen p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-[#f2f2f5] text-lg">
                {editing ? 'Edit Deal' : 'New Deal'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl text-[#4a4a58] hover:text-[#f2f2f5] hover:bg-[#1e1e22]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 pb-20">
              {/* Image Input */}
            {/* Image Input Section */}
<div>
  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Image</label>
  <div
    className="relative h-36 rounded-2xl border-2 border-dashed border-[#2a2a30] flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500/40 transition-colors"
    onClick={() => fileRef.current?.click()}
  >
    {imgPreview ? (
      <>
        <img src={imgPreview} alt="preview" className="absolute inset-0 w-full h-full object-cover rounded-2xl" />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
          <span className="text-white text-xs font-semibold flex items-center gap-1">
            <Upload size={12} /> Replace
          </span>
        </div>
      </>
    ) : (
      <>
        <Image size={24} className="text-[#3a3a48] mb-2" />
        <span className="text-[#3a3a48] text-xs">Click to upload image</span>
        <span className="text-[#2a2a30] text-[10px] mt-1">PNG, JPG under 2MB</span>
      </>
    )}
  </div>
  
  {/* Hidden File Input */}
  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

  {/* NEW/RESTORED: Paste Image URL Input */}
  <div className="mt-2">
    <input
      className="w-full px-3 py-2 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-xs placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40"
      placeholder="…or paste image URL"
      value={form.imageUrl?.startsWith('data:') ? '' : (form.imageUrl ?? '')}
      onChange={(e) => {
        const url = e.target.value;
        setForm((f) => ({ ...f, imageUrl: url }));
        setImgPreview(url);
      }}
    />
  </div>
</div>
              {/* Title */}
              <div>
                <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Title *</label>
                <input
                  className="w-full px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none focus:border-amber-500/40"
                  placeholder="Deal Title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Description</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none focus:border-amber-500/40"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Type & Display */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Type</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none"
                    value={form.dealType}
                    onChange={(e) => setForm((f) => ({ ...f, dealType: e.target.value as any }))}
                  >
                    {Object.entries(DEAL_ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Display</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none"
                    value={form.displayLocation}
                    onChange={(e) => setForm((f) => ({ ...f, displayLocation: e.target.value as any }))}
                  >
                    <option value="both">Both</option>
                    <option value="slider">Slider</option>
                    <option value="deals_section">Deals Section</option>
                  </select>
                </div>
              </div>

              {/* Discount Logic */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Discount Type</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none"
                    value={form.discountType}
                    onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as any }))}
                  >
                    <option value="flat">Flat ($)</option>
                    <option value="percent">Percent (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Value</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none"
                    value={form.discountValue}
                    onChange={(e) => setForm((f) => ({ ...f, discountValue: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Starts</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm"
                    value={form.validFrom}
                    onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">Ends</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm"
                    value={form.validTo}
                    onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                  />
                </div>
              </div>

              {/* RESTORED LINKED ITEMS FEATURE */}
              {menuItems.length > 0 && (
                <div>
                  <label className="block text-xs text-[#4a4a58] font-semibold uppercase tracking-wider mb-2">
                    Linked Items ({form.linkedItemIds.length} selected)
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl bg-[#111113] border border-[#222228] p-2">
                    {menuItems.map((item) => {
                      const selected = form.linkedItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItemLink(item.id)}
                          className={clsx(
                            'flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors',
                            selected ? 'bg-amber-500/15 border border-amber-500/25' : 'hover:bg-[#1a1a1e] border border-transparent'
                          )}
                        >
                          <span className={clsx('text-sm font-medium', selected ? 'text-amber-300' : 'text-[#9898a5]')}>
                            {item.name}
                          </span>
                          <div className={clsx(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                            selected ? 'border-amber-500 bg-amber-500' : 'border-[#3a3a48]'
                          )}>
                            {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#111113] border border-[#222228]">
                <div>
                  <div className="text-[#f2f2f5] text-sm font-semibold">Active</div>
                  <div className="text-[#4a4a58] text-xs">Visible to customers</div>
                </div>
                <button
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-amber-500' : 'bg-[#2a2a30]'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.isActive ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-[#222228] text-[#6a6a78] text-sm font-semibold">Cancel</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-display font-bold text-sm"
                >
                  {submitting ? 'Saving...' : editing ? 'Update Deal' : 'Create Deal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}