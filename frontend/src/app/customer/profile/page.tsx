'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { addressApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  LogOut, Phone, Mail, MapPin, Plus, Pencil,
  Trash2, Check, Navigation, Home, Briefcase,
  Star, Loader2, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

// ─── Types ──────────────────────────────────────────────
interface Address {
  id:          string;
  label:       string;
  type:        'home' | 'work' | 'other';
  addressText: string;
  houseNo?:    string;
  street?:     string;
  area?:       string;
  city?:       string;
  notes?:      string;
  latitude?:   number;
  longitude?:  number;
  isGps:       boolean;
  isDefault:   boolean;
}

const TYPE_ICONS: Record<string, any> = {
  home:  Home,
  work:  Briefcase,
  other: MapPin,
};

const TYPE_COLORS: Record<string, string> = {
  home:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  work:  'bg-blue-500/15 text-blue-400 border-blue-500/25',
  other: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
};

// ─── Address Card ────────────────────────────────────────
function AddressCard({ addr, onSetDefault, onDelete, onEdit }: {
  addr: Address;
  onSetDefault: (id: string) => void;
  onDelete:     (id: string) => void;
  onEdit:       (addr: Address) => void;
}) {
  const Icon = TYPE_ICONS[addr.type] ?? MapPin;

  return (
    <div className={clsx(
      'relative bg-white rounded-2xl border p-4 transition-all',
      addr.isDefault
        ? 'border-amber-400/40 shadow-md shadow-amber-400/10'
        : 'border-[#ece6dc] hover:border-amber-200'
    )}>
      {addr.isDefault && (
        <div className="absolute -top-2 left-4 flex items-center gap-1 px-2.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-md shadow-amber-400/30">
          <Star size={9} fill="white" /> Default
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${TYPE_COLORS[addr.type]}`}>
          <Icon size={15} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-[#1c1714] text-sm">{addr.label}</span>
            {addr.isGps && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
                <Navigation size={8} /> GPS
              </span>
            )}
          </div>
          <p className="text-[#7a6d63] text-[13px] leading-relaxed">{addr.addressText}</p>
          {addr.notes && (
            <p className="text-[#a39083] text-[11px] mt-1 italic">📝 {addr.notes}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#f0ebe3]">
        {!addr.isDefault && (
          <button
            onClick={() => onSetDefault(addr.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
          >
            <Check size={11} /> Set Default
          </button>
        )}
        <button
          onClick={() => onEdit(addr)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#7a6d63] bg-[#f5f0e8] hover:bg-[#ece6dc] border border-[#ece6dc] transition-colors"
        >
          <Pencil size={11} /> Edit
        </button>
        {!addr.isDefault && (
          <button
            onClick={() => onDelete(addr.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors ml-auto"
          >
            <Trash2 size={11} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Add/Edit Address Form (inline) ──────────────────────
function AddressForm({ initial, onSave, onCancel }: {
  initial?: Partial<Address>;
  onSave:   () => void;
  onCancel: () => void;
}) {
  const [label,    setLabel]    = useState(initial?.label       ?? 'Home');
  const [type,     setType]     = useState<'home'|'work'|'other'>(initial?.type ?? 'home');
  const [houseNo,  setHouseNo]  = useState(initial?.houseNo     ?? '');
  const [street,   setStreet]   = useState(initial?.street      ?? '');
  const [area,     setArea]     = useState(initial?.area        ?? '');
  const [city,     setCity]     = useState(initial?.city        ?? '');
  const [notes,    setNotes]    = useState(initial?.notes       ?? '');
  const [isDefault, setDefault] = useState(initial?.isDefault   ?? false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const handleSave = async () => {
    const parts = [houseNo, street, area, city].filter(Boolean);
    if (parts.length < 2) { setError('Fill in at least street and city'); return; }
    const addressText = parts.join(', ');
    setSaving(true);
    try {
      if (initial?.id) {
        await addressApi.update(initial.id, { label, type, addressText, houseNo, street, area, city, notes, isDefault });
        toast.success('Address updated');
      } else {
        await addressApi.create({ label, type, addressText, houseNo, street, area, city, notes, isDefault });
        toast.success('Address added!');
      }
      onSave();
    } catch {
      toast.error('Could not save address');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-sm outline-none focus:border-amber-400 transition-colors';

  return (
    <div className="bg-[#faf7f2] rounded-2xl border border-[#ece6dc] p-5 animate-slide-up">
      <h3 className="font-display font-bold text-[#1c1714] text-base mb-4">
        {initial?.id ? 'Edit Address' : 'Add New Address'}
      </h3>

      {error && <div className="text-red-500 text-sm mb-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}

      {/* Label + type row */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div>
          <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">Label</label>
          <input className={inputCls} placeholder="e.g. Home, Office" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">Type</label>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="home">🏠 Home</option>
            <option value="work">💼 Work</option>
            <option value="other">📍 Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div>
          <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">House / Flat</label>
          <input className={inputCls} placeholder="House no." value={houseNo} onChange={(e) => setHouseNo(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">City <span className="text-red-400">*</span></label>
          <input className={inputCls} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">Street / Road <span className="text-red-400">*</span></label>
        <input className={inputCls} placeholder="Street name" value={street} onChange={(e) => setStreet(e.target.value)} />
      </div>

      <div className="mb-3">
        <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">Area / Sector</label>
        <input className={inputCls} placeholder="Area or sector" value={area} onChange={(e) => setArea(e.target.value)} />
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">Delivery Notes</label>
        <input className={inputCls} placeholder="Gate colour, landmark, floor..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {/* Set as default toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#ece6dc] mb-4">
        <span className="text-sm text-[#5c5147] font-medium">Set as default address</span>
        <button
          type="button"
          onClick={() => setDefault(!isDefault)}
          className={`relative w-10 h-5 rounded-full transition-colors ${isDefault ? 'bg-amber-500' : 'bg-[#e0dbd4]'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isDefault ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>

      <div className="flex gap-2.5">
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-[#ece6dc] text-[#7a6d63] text-sm font-semibold hover:bg-[#f5f0e8] transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-press flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-xl font-semibold text-sm shadow-md shadow-amber-400/25 transition-all"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'Saving...' : initial?.id ? 'Save Changes' : 'Add Address'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN PROFILE PAGE
// ═══════════════════════════════════════════════════════

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  const [addresses,    setAddresses]   = useState<Address[]>([]);
  const [loadingAddr,  setLoadingAddr] = useState(false);
  const [showAddForm,  setShowAddForm] = useState(false);
  const [editingAddr,  setEditingAddr] = useState<Address | null>(null);

  const fetchAddresses = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingAddr(true);
    try {
      const res = await addressApi.getAll();
      setAddresses(res.data.data);
    } catch {
      // not critical — user may not have any
    } finally {
      setLoadingAddr(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const handleSetDefault = async (id: string) => {
    try {
      await addressApi.setDefault(id);
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
      toast.success('Default address updated');
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    try {
      await addressApi.remove(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success('Address deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleLogout = () => {
    logout();
    router.push('/customer/login');
  };

  if (!isAuthenticated) {
    return (
      <div className="pt-16 text-center animate-slide-up">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5 text-4xl">👤</div>
        <h2 className="font-display font-bold text-2xl text-[#1c1714] mb-2">Sign in to continue</h2>
        <p className="text-[#a39083] text-sm mb-6">Manage your profile and delivery addresses</p>
        <Link href="/customer/login" className="inline-flex items-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-display font-bold text-sm transition-colors shadow-md shadow-amber-400/30">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-5 pb-4 stagger-children">

      {/* ── Avatar card ──────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-[#ece6dc] p-6 mb-4 text-center animate-slide-up overflow-hidden relative">
        {/* Subtle gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/60 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg shadow-amber-400/30">
            🧀
          </div>
          <h2 className="font-display font-bold text-2xl text-[#1c1714]">{user?.name ?? 'Customer'}</h2>
          <p className="text-[#a39083] text-sm mt-1 font-ui">CheezyHub Member</p>
        </div>
      </div>

      {/* ── Contact info ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#ece6dc] overflow-hidden mb-4 animate-slide-up">
        {user?.mobile && (
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#f0ebe3]">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Phone size={14} className="text-amber-500" />
            </div>
            <div>
              <div className="text-[10px] text-[#a39083] font-bold uppercase tracking-wider">Mobile</div>
              <div className="text-[#1c1714] text-sm font-medium">{user.mobile}</div>
            </div>
          </div>
        )}
        {user?.email && (
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Mail size={14} className="text-amber-500" />
            </div>
            <div>
              <div className="text-[10px] text-[#a39083] font-bold uppercase tracking-wider">Email</div>
              <div className="text-[#1c1714] text-sm font-medium">{user.email}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── MY ADDRESSES ─────────────────────────────── */}
      <div className="animate-slide-up mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-amber-500" />
            <h3 className="font-display font-bold text-[#1c1714] text-base">My Addresses</h3>
            {addresses.length > 0 && (
              <span className="text-[11px] text-[#a39083] bg-[#f5f0e8] px-2 py-0.5 rounded-full font-semibold">{addresses.length}</span>
            )}
          </div>
          {!showAddForm && !editingAddr && (
            <button
              onClick={() => { setShowAddForm(true); setEditingAddr(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/25 text-[11px] font-bold hover:bg-amber-500/25 transition-colors"
            >
              <Plus size={12} /> Add Address
            </button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && !editingAddr && (
          <div className="mb-3">
            <AddressForm
              onSave={() => { setShowAddForm(false); fetchAddresses(); }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {/* Loading */}
        {loadingAddr && (
          <div className="flex flex-col gap-2.5">
            {[1,2].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        )}

        {/* Empty state */}
        {!loadingAddr && addresses.length === 0 && !showAddForm && (
          <div className="bg-white rounded-2xl border border-dashed border-[#ddd6cc] p-8 text-center">
            <div className="text-3xl mb-3">📍</div>
            <p className="font-semibold text-[#5c5147] text-sm mb-1">No saved addresses yet</p>
            <p className="text-[#a39083] text-xs mb-4">Add one for faster checkout</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm shadow-md shadow-amber-400/25"
            >
              <Plus size={14} /> Add First Address
            </button>
          </div>
        )}

        {/* Address list */}
        {!loadingAddr && addresses.length > 0 && (
          <div className="flex flex-col gap-3">
            {addresses.map((addr) => (
              editingAddr?.id === addr.id ? (
                <AddressForm
                  key={addr.id}
                  initial={editingAddr}
                  onSave={() => { setEditingAddr(null); fetchAddresses(); }}
                  onCancel={() => setEditingAddr(null)}
                />
              ) : (
                <AddressCard
                  key={addr.id}
                  addr={addr}
                  onSetDefault={handleSetDefault}
                  onDelete={handleDelete}
                  onEdit={(a) => { setEditingAddr(a); setShowAddForm(false); }}
                />
              )
            ))}
          </div>
        )}
      </div>

      {/* ── Quick links ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#ece6dc] overflow-hidden mb-5 animate-slide-up">
        {[
          { href: '/customer/orders',  label: 'Order History', sub: 'View past orders' },
          { href: '/customer/support', label: 'Support Tickets', sub: 'Get help fast' },
        ].map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center justify-between px-5 py-4 hover:bg-[#faf9f6] transition-colors',
              i === 0 && 'border-b border-[#f0ebe3]'
            )}
          >
            <div>
              <div className="text-[#1c1714] font-medium text-sm">{item.label}</div>
              <div className="text-[#a39083] text-[11px]">{item.sub}</div>
            </div>
            <ChevronRight size={15} className="text-[#c4b8ac]" />
          </Link>
        ))}
      </div>

      {/* ── Logout ───────────────────────────────────── */}
      <button
        onClick={handleLogout}
        className="btn-press w-full flex items-center justify-center gap-2 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-display font-bold text-sm border border-red-200 transition-colors animate-slide-up"
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
}
