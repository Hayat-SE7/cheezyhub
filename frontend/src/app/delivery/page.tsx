'use client';

import { useEffect, useState } from 'react';
import { deliveryApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import {
  MapPin, Navigation, CheckCircle2, Package,
  Clock, LogOut, TrendingUp, Bike
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface Order {
  id: string;
  orderNumber: string;
  status: 'assigned' | 'picked_up' | 'delivered' | 'completed';
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;
  total: number;
  createdAt: string;
  customer?: { name: string; mobile?: string };
  items?: { menuItemName: string; quantity: number }[];
}

// ─── Status config ────────────────────────────────────
const STATUS_CONFIG = {
  assigned: {
    label:     'Assigned',
    sublabel:  'Go pick up this order',
    color:     '#8b5cf6',
    glow:      'rgba(139,92,246,0.18)',
    border:    'rgba(139,92,246,0.3)',
    dot:       'bg-purple-400',
    barColor:  '#8b5cf6',
  },
  picked_up: {
    label:     'Picked Up',
    sublabel:  'En route to customer',
    color:     '#f97316',
    glow:      'rgba(249,115,22,0.18)',
    border:    'rgba(249,115,22,0.3)',
    dot:       'bg-orange-400',
    barColor:  '#f97316',
  },
};

// ─── Elapsed timer ────────────────────────────────────
function useElapsed(createdAt: string) {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    const calc = () => setMins(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
    calc();
    const t = setInterval(calc, 30000);
    return () => clearInterval(t);
  }, [createdAt]);
  return mins;
}

// ─── Delivery Card ────────────────────────────────────
function DeliveryCard({ order, onStatusUpdate }: {
  order: Order;
  onStatusUpdate: (id: string, status: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.assigned;
  const mins = useElapsed(order.createdAt);

  const openMaps = () => {
    const q = order.deliveryLat
      ? `${order.deliveryLat},${order.deliveryLng}`
      : encodeURIComponent(order.deliveryAddress);
    window.open(`https://www.google.com/maps?q=${q}`, '_blank');
  };

  const handleAction = async () => {
    const nextStatus = order.status === 'assigned' ? 'picked_up' : 'delivered';
    setLoading(true);
    try {
      await deliveryApi.setStatus(order.id, nextStatus);
      onStatusUpdate(order.id, nextStatus);
      toast.success(
        nextStatus === 'picked_up' ? '📦 Marked as picked up!' : '🎉 Delivery completed!',
        { style: { background: '#0f0f11', color: '#f2f2f5', border: '1px solid #2a2a30' } }
      );
    } catch {
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-3xl overflow-hidden border"
      style={{
        background:   '#0f0f11',
        borderColor:  cfg.border,
        boxShadow:    `0 0 32px ${cfg.glow}, 0 4px 16px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Top accent bar + status */}
      <div
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}40, transparent)` }}
      />

      <div className="p-5">
        {/* Header: order + timer */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-mono text-[11px] text-[#4a4a58]">{order.orderNumber}</div>
            <div className="font-display font-bold text-[#f2f2f5] text-base mt-0.5">
              {order.customer?.name ?? 'Customer'}
            </div>
            {order.customer?.mobile && (
              <a
                href={`tel:${order.customer.mobile}`}
                className="text-xs text-[#6a6a78] hover:text-[#9898a5] transition-colors"
              >
                {order.customer.mobile}
              </a>
            )}
          </div>
          <div className="text-right">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
              style={{ color: cfg.color, background: `${cfg.color}15`, borderColor: `${cfg.color}30` }}
            >
              <span className={clsx('w-1.5 h-1.5 rounded-full pulse-dot', cfg.dot)} />
              {cfg.label}
            </div>
            <div className="text-[11px] text-[#4a4a58] mt-1.5 flex items-center gap-1 justify-end">
              <Clock size={10} />
              {mins < 1 ? 'Just now' : `${mins}m ago`}
            </div>
          </div>
        </div>

        {/* Items summary */}
        {order.items && order.items.length > 0 && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-[#1a1a1e] border border-[#222228]">
            <div className="text-[11px] text-[#4a4a58] font-semibold uppercase tracking-wider mb-1.5">Items</div>
            {order.items.slice(0, 3).map((item, i) => (
              <div key={i} className="text-[12px] text-[#9898a5]">
                {item.quantity}× {item.menuItemName}
              </div>
            ))}
            {order.items.length > 3 && (
              <div className="text-[11px] text-[#4a4a58] mt-0.5">+{order.items.length - 3} more</div>
            )}
          </div>
        )}

        {/* Delivery address */}
        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${cfg.color}15` }}
          >
            <MapPin size={16} style={{ color: cfg.color }} />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-[#4a4a58] font-semibold uppercase tracking-wide mb-0.5">Deliver to</div>
            <div className="text-[#d4d4dc] text-sm leading-snug">{order.deliveryAddress}</div>
          </div>
          <div className="font-display font-black text-amber-400 text-base flex-shrink-0">
            ${order.total.toFixed(2)}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {/* Navigate */}
          <button
            onClick={openMaps}
            className="btn-press flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-display font-bold text-sm border transition-all"
            style={{
              background:   'rgba(59,130,246,0.12)',
              color:         '#60a5fa',
              borderColor:  'rgba(59,130,246,0.25)',
            }}
          >
            <Navigation size={15} /> Navigate
          </button>

          {/* Primary action */}
          {order.status === 'assigned' && (
            <button
              onClick={handleAction}
              disabled={loading}
              className="btn-press flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-display font-bold text-sm border transition-all disabled:opacity-60"
              style={{
                background:   `${cfg.color}18`,
                color:         cfg.color,
                borderColor:  `${cfg.color}30`,
              }}
            >
              <Package size={15} />
              {loading ? 'Updating...' : 'Picked Up'}
            </button>
          )}
          {order.status === 'picked_up' && (
            <button
              onClick={handleAction}
              disabled={loading}
              className="btn-press flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-display font-bold text-sm border transition-all disabled:opacity-60"
              style={{
                background:   'rgba(16,185,129,0.15)',
                color:         '#34d399',
                borderColor:  'rgba(16,185,129,0.3)',
              }}
            >
              <CheckCircle2 size={15} />
              {loading ? 'Updating...' : 'Delivered ✓'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Delivery Page ────────────────────────────────────
export default function DeliveryPage() {
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading,  setLoading]  = useState(true);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  useEffect(() => {
    deliveryApi.getMyOrders()
      .then((res) => setMyOrders(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  useSSE({
    onEvent: {
      ORDER_ASSIGNED: (data: any) => {
        setMyOrders((prev) => [data, ...prev]);
        toast('📦 New delivery assigned!', {
          icon: '🛵',
          style: { background: '#1a0a3e', color: '#c4b5fd', border: '1px solid #7c3aed40' },
          duration: 6000,
        });
      },
      ORDER_UPDATED: (data: any) => {
        setMyOrders((prev) =>
          prev.map((o) => (o.id === data.orderId ? { ...o, status: data.status } : o))
        );
      },
    },
  });

  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    setMyOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o))
    );
  };

  const active    = myOrders.filter((o) => ['assigned', 'picked_up'].includes(o.status));
  const completed = myOrders.filter((o) => ['delivered', 'completed'].includes(o.status));

  return (
    <div className="min-h-screen bg-[#060607] text-[#f2f2f5]">
      {/* Header */}
      <div className="bg-[#0a0a0c] border-b border-[#1a1a1e] px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/30 to-orange-500/20 border border-purple-500/30 flex items-center justify-center">
              <Bike size={18} className="text-purple-400" />
            </div>
            <div>
              <h1 className="font-display font-black text-[#f2f2f5] text-lg leading-tight">Delivery</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                <span className="text-[#4a4a58] text-xs">
                  {active.length} active · {completed.length} done today
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push('/delivery/login'); }}
            className="p-2.5 rounded-xl text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-5 space-y-6">

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active',    value: active.length,    color: '#8b5cf6' },
            { label: 'Completed', value: completed.length, color: '#10b981' },
            { label: 'Earnings',  value: `$${completed.reduce((s, o) => s + o.total, 0).toFixed(0)}`, color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-[#111113] border border-[#222228] p-3.5 text-center">
              <div className="font-display font-black text-xl" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] text-[#4a4a58] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Active deliveries */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />
            <h2 className="font-display font-bold text-[#9898a5] text-[11px] uppercase tracking-widest">
              Active Deliveries
            </h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-56 rounded-3xl" />)}
            </div>
          ) : active.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#222228] p-14 text-center">
              <div className="text-5xl mb-3 opacity-20">🛵</div>
              <div className="font-display font-bold text-[#3a3a48] text-sm">No active deliveries</div>
              <div className="text-[#2a2a30] text-xs mt-1">New assignments will appear here</div>
            </div>
          ) : (
            <AnimatePresence>
              <div className="space-y-4">
                {active.map((order) => (
                  <DeliveryCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Completed today */}
        {completed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={12} className="text-emerald-400" />
              <h2 className="font-display font-bold text-[#9898a5] text-[11px] uppercase tracking-widest">
                Completed Today
              </h2>
            </div>
            <div className="space-y-2">
              {completed.slice(0, 8).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#111113] border border-[#1e1e22]"
                >
                  <div>
                    <div className="font-mono text-[11px] text-[#4a4a58]">{order.orderNumber}</div>
                    <div className="text-[#6a6a78] text-xs mt-0.5 truncate max-w-[200px]">
                      {order.deliveryAddress}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-3">
                    <span className="font-display font-bold text-emerald-400 text-sm">${order.total.toFixed(2)}</span>
                    <CheckCircle2 size={15} className="text-emerald-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
