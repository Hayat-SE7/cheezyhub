'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomers, CustomerRow } from '@/hooks/useCustomers';
import { adminApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  Search, Filter, Download, Users, AlertTriangle,
  Ban, Check, ChevronRight, RefreshCw, ArrowUpDown,
} from 'lucide-react';

// ─── Customer tags ────────────────────────────────────────────────
const TAG_STYLES: Record<string, string> = {
  'VIP':                'bg-amber-100 text-amber-800 border-amber-200',
  'Bulk Buyer':         'bg-blue-100 text-blue-800 border-blue-200',
  'Frequent Complaint': 'bg-red-100 text-red-800 border-red-200',
  'Discount Given':     'bg-purple-100 text-purple-800 border-purple-200',
  'New Customer':       'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const ALL_TAGS = Object.keys(TAG_STYLES);

function TagBadge({ tag }: { tag: string }) {
  return (
    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold border', TAG_STYLES[tag] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>
      {tag}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────
function StatusBadge({ blocked }: { blocked: boolean }) {
  return blocked ? (
    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-semibold">
      <Ban size={10} /> Blocked
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold">
      <Check size={10} /> Active
    </span>
  );
}

// ─── Table Row ────────────────────────────────────────────────────
function CustomerTableRow({ c, onToggleBlock }: { c: CustomerRow; onToggleBlock: (c: CustomerRow) => void }) {
  const router  = useRouter();

  return (
    <tr
      className={clsx(
        'border-b border-[#1e1e28] hover:bg-[#14141c] cursor-pointer transition-colors group',
        c.isAtRisk && 'bg-amber-500/5 hover:bg-amber-500/10',
      )}
      onClick={() => router.push(`/admin/customers/${c.id}`)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-[#f2f2f5] text-sm flex items-center gap-2">
              {c.name}
              {c.isAtRisk && <AlertTriangle size={12} className="text-amber-400" />}
            </div>
            <div className="text-xs text-[#4a4a58]">{c.mobile ?? c.email ?? '—'}</div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {c.tags.map((t) => <TagBadge key={t} tag={t} />)}
        </div>
      </td>

      <td className="px-4 py-3 text-sm text-[#9898a5] text-right">{c.totalOrders}</td>
      <td className="px-4 py-3 text-sm text-[#f2f2f5] text-right font-medium">
        Rs. {c.totalSpent.toLocaleString()}
      </td>

      <td className="px-4 py-3 text-xs text-[#4a4a58] text-center">
        {c.lastOrderAt ? formatDistanceToNow(new Date(c.lastOrderAt), { addSuffix: true }) : '—'}
      </td>

      <td className="px-4 py-3 text-center">
        <StatusBadge blocked={c.isBlocked} />
      </td>

      <td className="px-4 py-3 text-center" onClick={(e) => { e.stopPropagation(); onToggleBlock(c); }}>
        <button className={clsx(
          'text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors',
          c.isBlocked
            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
        )}>
          {c.isBlocked ? 'Unblock' : 'Block'}
        </button>
      </td>

      <td className="px-4 py-3 text-center text-[#4a4a58] group-hover:text-[#9898a5]">
        <ChevronRight size={15} />
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────
export default function AdminCustomersPage() {
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'blocked'>('all');
  const [sort,   setSort]   = useState<'recent' | 'spent' | 'orders'>('recent');
  const [atRisk, setAtRisk] = useState(false);

  const { data, total, loading, refetch } = useCustomers({ page, search, status, sort, atRisk });
  const totalPages = Math.ceil(total / 25);

  const handleToggleBlock = useCallback(async (c: CustomerRow) => {
    try {
      await adminApi.updateCustomer(c.id, { isBlocked: !c.isBlocked });
      toast.success(c.isBlocked ? `${c.name} unblocked` : `${c.name} blocked`);
      refetch();
    } catch {
      toast.error('Failed to update customer');
    }
  }, [refetch]);

  const handleExportAll = () => {
    toast('Export all — use individual customer export for CSV', { icon: 'ℹ️' });
  };

  const sortCycles: Array<'recent' | 'spent' | 'orders'> = ['recent', 'spent', 'orders'];
  const nextSort = () => setSort((s) => sortCycles[(sortCycles.indexOf(s) + 1) % sortCycles.length]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Customers</h1>
          <p className="text-[#4a4a58] text-sm mt-0.5">
            {total.toLocaleString()} total
            {atRisk && <span className="ml-2 text-amber-400 font-semibold">· showing at-risk only</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportAll} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a1a24] text-[#9898a5] hover:text-[#f2f2f5] text-sm transition-colors">
            <Download size={14} /> Export
          </button>
          <button onClick={refetch} className="p-2 rounded-lg bg-[#1a1a24] text-[#9898a5] hover:text-[#f2f2f5] transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a58]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, mobile, email…"
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0c0c0e] border border-[#1e1e28] text-[#f2f2f5] placeholder-[#4a4a58] text-sm focus:outline-none focus:border-amber-500/40"
          />
        </div>

        {/* Status */}
        <div className="flex rounded-lg overflow-hidden border border-[#1e1e28]">
          {(['all', 'active', 'blocked'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={clsx('px-3 py-1.5 text-xs font-semibold capitalize transition-colors', status === s ? 'bg-amber-500 text-white' : 'bg-[#0c0c0e] text-[#9898a5] hover:text-[#f2f2f5]')}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Sort */}
        <button onClick={nextSort} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c0c0e] border border-[#1e1e28] text-[#9898a5] hover:text-[#f2f2f5] text-xs font-semibold transition-colors capitalize">
          <ArrowUpDown size={12} /> {sort}
        </button>

        {/* At-risk toggle */}
        <button
          onClick={() => { setAtRisk((v) => !v); setPage(1); }}
          className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors', atRisk ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-[#0c0c0e] border-[#1e1e28] text-[#9898a5] hover:text-amber-400')}
        >
          <AlertTriangle size={12} /> At-risk
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1e1e28] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#0c0c0e] border-b border-[#1e1e28]">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Customer</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Tags</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Orders</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Spent</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Last Order</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Status</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#4a4a58] uppercase tracking-wide">Action</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[#1e1e28]">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-[#1e1e28] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-[#4a4a58]">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No customers found</p>
                </td>
              </tr>
            ) : (
              data.map((c) => <CustomerTableRow key={c.id} c={c} onToggleBlock={handleToggleBlock} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-[#1a1a24] text-[#9898a5] hover:text-[#f2f2f5] disabled:opacity-40 text-sm transition-colors">
            Previous
          </button>
          <span className="text-sm text-[#4a4a58]">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg bg-[#1a1a24] text-[#9898a5] hover:text-[#f2f2f5] disabled:opacity-40 text-sm transition-colors">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
