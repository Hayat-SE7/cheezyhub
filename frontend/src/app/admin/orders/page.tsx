'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Search, Truck, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Driver { id: string; username: string; }
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  deliveryAddress: string;
  createdAt: string;
  customer: { name: string; mobile?: string };
  driver?: { username: string };
  items: { menuItemName: string; quantity: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'badge-pending',
  preparing: 'badge-preparing',
  ready:     'badge-ready',
  assigned:  'badge-assigned',
  picked_up: 'badge-picked_up',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
};

const ACTIVE_STATUSES = ['pending', 'preparing', 'ready', 'assigned', 'picked_up'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignModal, setAssignModal] = useState<Order | null>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [assigning, setAssigning] = useState(false);

  const LIMIT = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getOrders({ status: statusFilter || undefined, search: search || undefined, page, limit: LIMIT });
      const d = res.data.data;
      setOrders(d.items);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { adminApi.getDrivers().then((r) => setDrivers(r.data.data)); }, []);

  useSSE({
    onEvent: {
      ORDER_CREATED: () => { if (page === 1) fetchOrders(); },
      ORDER_UPDATED: () => fetchOrders(),
    },
  });

  const handleAssign = async () => {
    if (!assignModal || !selectedDriver) return;
    setAssigning(true);
    try {
      await adminApi.assignDriver(assignModal.id, selectedDriver);
      toast.success(`Driver assigned to ${assignModal.orderNumber}`);
      setAssignModal(null);
      setSelectedDriver('');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  const handleCancel = async (order: Order) => {
    if (!confirm(`Cancel order ${order.orderNumber}?`)) return;
    try {
      await adminApi.cancelOrder(order.id);
      toast.success('Order cancelled');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to cancel');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f2f2f5]">Orders</h1>
          <p className="text-[#4a4a58] text-sm mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-[#4a4a58]">Live</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a4a58]" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40"
            placeholder="Search order #, customer, address..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="px-4 py-2.5 rounded-xl bg-[#111113] border border-[#222228] text-[#f2f2f5] text-sm outline-none focus:border-amber-500/40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[#0f0f11] border border-[#222228] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center text-[#3a3a48]">No orders found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e22]">
                {['Order', 'Customer', 'Items', 'Total', 'Status', 'Driver', 'Time', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-[#4a4a58] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[#161618] hover:bg-[#111113] transition-colors">
                  <td className="px-4 py-3 font-mono text-[11px] text-[#6a6a78]">{order.orderNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#d4d4dc]">{order.customer.name}</div>
                    {order.customer.mobile && <div className="text-[11px] text-[#4a4a58]">{order.customer.mobile}</div>}
                  </td>
                  <td className="px-4 py-3 text-[#9898a5]">
                    {order.items.slice(0, 2).map((i) => `${i.quantity}× ${i.menuItemName}`).join(', ')}
                    {order.items.length > 2 && ` +${order.items.length - 2}`}
                  </td>
                  <td className="px-4 py-3 font-display font-bold text-amber-400">${order.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-[11px] px-2 py-1 rounded-lg font-bold capitalize', STATUS_COLORS[order.status])}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#6a6a78] text-[12px]">
                    {order.driver?.username ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[#4a4a58] text-[11px]">
                    {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {order.status === 'ready' && (
                        <button
                          onClick={() => { setAssignModal(order); setSelectedDriver(''); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/25 text-[11px] font-bold hover:bg-purple-500/25 transition-colors"
                        >
                          <Truck size={11} /> Assign
                        </button>
                      )}
                      {ACTIVE_STATUSES.includes(order.status) && (
                        <button
                          onClick={() => handleCancel(order)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 text-[11px] font-bold hover:bg-red-500/25 transition-colors"
                        >
                          <X size={11} /> Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[#4a4a58] text-xs">{total} orders</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-[#111113] border border-[#222228] text-[#4a4a58] disabled:opacity-30 hover:text-[#f2f2f5] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[#6a6a78] text-xs font-mono">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-[#111113] border border-[#222228] text-[#4a4a58] disabled:opacity-30 hover:text-[#f2f2f5] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Assign Driver Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[#111113] rounded-3xl border border-[#222228] p-6 animate-scale-pop">
            <h2 className="font-display font-bold text-[#f2f2f5] text-lg mb-1">Assign Driver</h2>
            <p className="text-[#4a4a58] text-sm mb-5">Order {assignModal.orderNumber}</p>

            <select
              className="w-full px-4 py-3 rounded-xl bg-[#0f0f11] border border-[#222228] text-[#f2f2f5] text-sm outline-none focus:border-amber-500/40 mb-4"
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
            >
              <option value="">Select a driver...</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.username}</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#222228] text-[#6a6a78] text-sm font-semibold hover:border-[#333340] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedDriver || assigning}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-display font-bold transition-colors"
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
