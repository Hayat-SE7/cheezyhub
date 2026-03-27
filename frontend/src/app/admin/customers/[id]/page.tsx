'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCustomer } from '@/hooks/useCustomer';
import { adminApi } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Ban, Check, Download, Save, Tag as TagIcon,
  ShoppingBag, MapPin, Clock, AlertTriangle, User, Mail, Phone,
} from 'lucide-react';

// ─── Customer tags ────────────────────────────────────────────────
const ALL_TAGS = ['VIP', 'Bulk Buyer', 'Frequent Complaint', 'Discount Given', 'New Customer'];
const TAG_STYLES: Record<string, string> = {
  'VIP':                'bg-amber-100 text-amber-800 border-amber-200',
  'Bulk Buyer':         'bg-blue-100 text-blue-800 border-blue-200',
  'Frequent Complaint': 'bg-red-100 text-red-800 border-red-200',
  'Discount Given':     'bg-purple-100 text-purple-800 border-purple-200',
  'New Customer':       'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  completed:  'text-emerald-400 bg-emerald-500/10',
  cancelled:  'text-red-400 bg-red-500/10',
  pending:    'text-amber-400 bg-amber-500/10',
  preparing:  'text-blue-400 bg-blue-500/10',
  ready:      'text-purple-400 bg-purple-500/10',
  assigned:   'text-cyan-400 bg-cyan-500/10',
  picked_up:  'text-indigo-400 bg-indigo-500/10',
  delivered:  'text-emerald-400 bg-emerald-500/10',
};

const TIMELINE_ICONS: Record<string, string> = {
  account_created: '👤',
  address_added:   '📍',
  order:           '🛍️',
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id     = params.id as string;

  const { data, loading, error, update } = useCustomer(id);
  const [note,    setNote]    = useState('');
  const [noteSet, setNoteSet] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState<'orders' | 'addresses' | 'timeline'>('orders');

  // Sync note from data once loaded
  if (data && !noteSet) { setNote(data.adminNote ?? ''); setNoteSet(true); }

  const handleSaveNote = async () => {
    setSaving(true);
    try { await update({ adminNote: note }); toast.success('Note saved'); } catch { toast.error('Failed to save note'); } finally { setSaving(false); }
  };

  const handleToggleBlock = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await update({ isBlocked: !data.isBlocked });
      toast.success(data.isBlocked ? `${data.name} unblocked` : `${data.name} blocked`);
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const handleToggleTag = async (tag: string) => {
    if (!data) return;
    const next = data.tags.includes(tag) ? data.tags.filter((t) => t !== tag) : [...data.tags, tag];
    try { await update({ tags: next }); toast.success('Tags updated'); } catch { toast.error('Failed'); }
  };

  const handleExport = async () => {
    try {
      const res = await adminApi.exportCustomer(id);
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url; a.download = `customer-${id}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-6 w-48 bg-[#1e1e28] rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-[#1e1e28] rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-[#4a4a58] py-20">
        <User size={40} className="mx-auto mb-3 opacity-30" />
        <p>{error ?? 'Customer not found'}</p>
        <button onClick={() => router.push('/admin/customers')} className="mt-4 text-amber-400 text-sm">← Back</button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/admin/customers')} className="p-2 rounded-lg bg-[#1a1a24] text-[#9898a5] hover:text-[#f2f2f5] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl text-[#f2f2f5] flex items-center gap-2">
            {data.name}
            {data.isBlocked && <Ban size={16} className="text-red-400" />}
          </h1>
          <p className="text-[#4a4a58] text-sm">Member since {format(new Date(data.createdAt), 'MMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a1a24] text-[#9898a5] hover:text-[#f2f2f5] text-sm transition-colors">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={handleToggleBlock} disabled={saving} className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors', data.isBlocked ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20')}>
            {data.isBlocked ? <><Check size={14} /> Unblock</> : <><Ban size={14} /> Block</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: profile + admin tools */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
                {data.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-[#f2f2f5]">{data.name}</p>
                <p className="text-xs text-[#4a4a58]">{data.isBlocked ? 'Blocked' : 'Active'}</p>
              </div>
            </div>
            <div className="space-y-2 pt-1">
              {data.mobile && (
                <div className="flex items-center gap-2 text-sm text-[#9898a5]">
                  <Phone size={13} className="text-[#4a4a58]" /> {data.mobile}
                </div>
              )}
              {data.email && (
                <div className="flex items-center gap-2 text-sm text-[#9898a5]">
                  <Mail size={13} className="text-[#4a4a58]" /> {data.email}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[#9898a5]">
                <MapPin size={13} className="text-[#4a4a58]" /> {data.addresses.length} saved addresses
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4 text-center">
              <div className="font-bold text-2xl text-amber-400">{data.totalOrders}</div>
              <div className="text-xs text-[#4a4a58] mt-0.5">Total Orders</div>
            </div>
            <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4 text-center">
              <div className="font-bold text-lg text-emerald-400">Rs. {data.totalSpent.toLocaleString()}</div>
              <div className="text-xs text-[#4a4a58] mt-0.5">Total Spent</div>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TagIcon size={14} className="text-[#4a4a58]" />
              <span className="text-sm font-semibold text-[#9898a5]">Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map((tag) => {
                const active = data.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className={clsx(
                      'text-[11px] px-2 py-1 rounded-full border font-semibold transition-all',
                      active ? TAG_STYLES[tag] : 'bg-[#1a1a24] text-[#4a4a58] border-[#1e1e28] hover:border-[#3a3a48]',
                    )}
                  >
                    {active ? '✓ ' : ''}{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin note */}
          <div className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4">
            <p className="text-sm font-semibold text-[#9898a5] mb-2">Admin Note</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Private notes about this customer…"
              className="w-full px-3 py-2 rounded-lg bg-[#07070a] border border-[#1e1e28] text-[#f2f2f5] text-sm placeholder-[#3a3a48] focus:outline-none focus:border-amber-500/40 resize-none"
            />
            <button
              onClick={handleSaveNote}
              disabled={saving}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Save size={13} /> Save Note
            </button>
          </div>
        </div>

        {/* Right column: tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-1">
            {(['orders', 'addresses', 'timeline'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors', tab === t ? 'bg-amber-500 text-white' : 'text-[#9898a5] hover:text-[#f2f2f5]')}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Orders */}
          {tab === 'orders' && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {data.orders.length === 0 ? (
                <div className="text-center py-12 text-[#4a4a58]">
                  <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
                  <p>No orders yet</p>
                </div>
              ) : data.orders.map((o: any) => (
                <div key={o.id} className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-[#f2f2f5] text-sm">#{o.orderNumber}</span>
                      <span className="ml-2 text-xs text-[#4a4a58]">{format(new Date(o.createdAt), 'MMM d, yyyy · h:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize', ORDER_STATUS_STYLES[o.status] ?? 'text-[#9898a5] bg-[#1a1a24]')}>
                        {o.status}
                      </span>
                      <span className="font-semibold text-[#f2f2f5] text-sm">Rs. {o.total.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {o.items.map((item: any, i: number) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 bg-[#1a1a24] text-[#9898a5] rounded-full">
                        {item.quantity}× {item.menuItemName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Addresses */}
          {tab === 'addresses' && (
            <div className="space-y-2">
              {data.addresses.length === 0 ? (
                <div className="text-center py-12 text-[#4a4a58]">
                  <MapPin size={36} className="mx-auto mb-2 opacity-30" />
                  <p>No saved addresses</p>
                </div>
              ) : data.addresses.map((a: any) => (
                <div key={a.id} className="bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-4">
                  <p className="font-semibold text-[#f2f2f5] text-sm">{a.label ?? 'Address'}</p>
                  <p className="text-sm text-[#9898a5] mt-0.5">{a.addressLine1}{a.addressLine2 ? `, ${a.addressLine2}` : ''}</p>
                  {a.city && <p className="text-xs text-[#4a4a58]">{a.city}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          {tab === 'timeline' && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {data.timeline.map((e: any, i: number) => (
                <div key={i} className="flex items-start gap-3 bg-[#0c0c0e] border border-[#1e1e28] rounded-xl p-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">{TIMELINE_ICONS[e.type] ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#f2f2f5] leading-snug">{e.label}</p>
                    <p className="text-xs text-[#4a4a58] mt-0.5">
                      {formatDistanceToNow(new Date(e.date), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
