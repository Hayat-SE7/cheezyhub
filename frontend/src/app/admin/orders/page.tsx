'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi }            from '@/lib/api';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw,
  Package, Clock, WifiOff, Truck, ChefHat, ShoppingBag,
  CheckCircle2, XCircle, Circle,
} from 'lucide-react';
import { clsx }                from 'clsx';
import { formatDistanceToNow } from 'date-fns';

// ─── Constants ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:    { label: 'Pending',    color: 'text-amber-400',  bg: 'bg-amber-500/10',   icon: <Clock size={11} /> },
  preparing:  { label: 'Preparing', color: 'text-blue-400',   bg: 'bg-blue-500/10',    icon: <ChefHat size={11} /> },
  ready:      { label: 'Ready',     color: 'text-emerald-400',bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={11} /> },
  assigned:   { label: 'Assigned',  color: 'text-purple-400', bg: 'bg-purple-500/10',  icon: <Truck size={11} /> },
  picked_up:  { label: 'Picked Up', color: 'text-indigo-400', bg: 'bg-indigo-500/10',  icon: <Truck size={11} /> },
  delivered:  { label: 'Delivered', color: 'text-teal-400',   bg: 'bg-teal-500/10',    icon: <CheckCircle2 size={11} /> },
  completed:  { label: 'Completed', color: 'text-emerald-400',bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={11} /> },
  cancelled:  { label: 'Cancelled', color: 'text-red-400',    bg: 'bg-red-500/10',     icon: <XCircle size={11} /> },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  delivery: <Truck size={11} />,
  counter:  <ShoppingBag size={11} />,
  dine_in:  <Package size={11} />,
};

const STATUS_FILTERS = [
  { key: '',          label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready',     label: 'Ready' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'offline',   label: '📡 Offline Sync' },  // Phase 12 filter
];

export default function AdminOrdersPage() {
  const [orders,    setOrders]    = useState<any[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [totalPages,setTotalPages]= useState(1);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter]       = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Phase 12: "offline" is a synthetic filter, not a real status
      const params: Record<string, any> = {
        page,
        limit: 25,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter && statusFilter !== 'offline' && { status: statusFilter }),
        ...(statusFilter === 'offline' && { offlineSync: true }),
      };
      const res = await adminApi.getOrders(params);
      const data = res.data.data;
      setOrders(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Orders</h1>
          <p className="text-sm text-[#4a4a58] mt-0.5">{total.toLocaleString()} total orders</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111116] border border-[#1e1e28] text-xs text-[#6a6a78] hover:text-white transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search + status filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a58]" />
          <input
            className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#111116] border border-[#1e1e28] text-sm text-[#f2f2f5] placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40 transition-colors"
            placeholder="Search order number, address, customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
              statusFilter === f.key
                ? f.key === 'offline'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-[#111116] border border-[#1e1e28] text-[#4a4a58] hover:text-[#f2f2f5]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0c0c0f] border border-[#1e1e28] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-amber-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={32} className="text-[#2a2a35] mb-3" />
            <p className="text-sm text-[#4a4a58]">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e28]">
                  {['Order', 'Type', 'Customer', 'Items', 'Total', 'Status', 'Time'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#3a3a48]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0f0f14]">
                {orders.map((order) => {
                  const s = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'text-[#4a4a58]', bg: 'bg-[#111116]', icon: <Circle size={11} /> };
                  return (
                    <tr key={order.id} className="hover:bg-[#111116] transition-colors group">

                      {/* Order number + offline badge */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#f2f2f5]">
                            {order.orderNumber}
                          </span>
                          {/* Phase 12: Offline Sync badge */}
                          {order.offlineSync && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-bold text-indigo-300 whitespace-nowrap">
                              <WifiOff size={8} />
                              Offline Sync
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-[#6a6a78]">
                          {TYPE_ICON[order.orderType] ?? <Package size={11} />}
                          <span className="capitalize">{order.orderType?.replace('_', ' ')}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-[#9898a5]">
                          {order.customer?.name ?? 'Walk-in'}
                        </p>
                        {order.customer?.mobile && (
                          <p className="text-[10px] text-[#3a3a48] mt-0.5">{order.customer.mobile}</p>
                        )}
                      </td>

                      {/* Items count */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#6a6a78]">
                          {order.items?.length ?? 0} item{order.items?.length !== 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-amber-500">
                          Rs.{order.total?.toFixed(0)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold',
                          s.color, s.bg
                        )}>
                          {s.icon}
                          {s.label}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-[#3a3a48]">
                          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[#3a3a48]">
            Page {page} of {totalPages} · {total} orders
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111116] border border-[#1e1e28] text-xs text-[#4a4a58] hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111116] border border-[#1e1e28] text-xs text-[#4a4a58] hover:text-white disabled:opacity-30 transition-colors"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
