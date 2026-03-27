'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { kitchenApi } from '@/lib/api';
import { useKitchenSSE } from '@/hooks/useKitchenSSE';
import { clsx } from 'clsx';
import { LogOut, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useKitchenStore } from '@/store/kitchenStore';
import { useRouter } from 'next/navigation';

interface OrderItem {
  id: string;
  menuItemName: string;
  quantity: number;
  selectedModifiers: { name: string }[];
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  customer?: { name: string };
}

// ─── Column config ───────────────────────────────────

const COLS = {
  pending: {
    label:  'New Orders',
    color:  '#f59e0b',
    glow:   'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    dot:    'bg-amber-400',
    badge:  'bg-amber-500/20 text-amber-300',
    next:   'preparing' as const,
    action: 'Start Cooking',
  },
  preparing: {
    label:  'Preparing',
    color:  '#3b82f6',
    glow:   'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.25)',
    dot:    'bg-blue-400',
    badge:  'bg-blue-500/20 text-blue-300',
    next:   'ready' as const,
    action: 'Mark Ready',
  },
  ready: {
    label:  'Ready',
    color:  '#10b981',
    glow:   'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.25)',
    dot:    'bg-emerald-400',
    badge:  'bg-emerald-500/20 text-emerald-300',
    next:   null,
    action: '',
  },
};

// ─── Live timer hook ──────────────────────────────────

function useElapsedTime(createdAt: string): { label: string; urgent: boolean } {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      setElapsed(secs);
    };
    update();
    const t = setInterval(update, 10000); // update every 10s
    return () => clearInterval(t);
  }, [createdAt]);

  const mins = Math.floor(elapsed / 60);
  const urgent = mins >= 10; // >10 min = urgent

  const label = mins < 1 ? 'Just now'
    : mins === 1 ? '1 min'
    : mins < 60 ? `${mins} min`
    : `${Math.floor(mins / 60)}h ${mins % 60}m`;

  return { label, urgent };
}

// ─── Timer Badge ──────────────────────────────────────

function TimerBadge({ createdAt }: { createdAt: string }) {
  const { label, urgent } = useElapsedTime(createdAt);
  return (
    <div className={clsx(
      'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
      urgent
        ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
        : 'bg-[#1a1a1e] text-[#6a6a78] border border-[#222228]'
    )}>
      <Clock size={9} className={urgent ? 'text-red-400' : 'text-[#4a4a58]'} />
      {label}
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────

function OrderCard({ order, col, onAction }: {
  order: Order;
  col: typeof COLS[keyof typeof COLS];
  onAction: (id: string, status: string) => void;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden animate-slide-up"
      style={{
        background:    '#0f0f11',
        borderColor:   col.border,
        boxShadow:     `0 0 24px ${col.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Top accent bar */}
      <div
        className="h-[3px]"
        style={{ background: `linear-gradient(90deg, ${col.color}, ${col.color}60, transparent)` }}
      />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-mono text-[11px] text-[#4a4a58]">{order.orderNumber}</div>
            {order.customer?.name && (
              <div className="text-[#9898a5] text-xs font-medium mt-0.5">{order.customer.name}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <TimerBadge createdAt={order.createdAt} />
            <div className="font-display font-bold text-amber-400 text-sm">${order.total.toFixed(2)}</div>
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-2 mb-4">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <div
                className="font-mono font-black text-sm leading-none flex-shrink-0 min-w-[20px]"
                style={{ color: col.color }}
              >
                ×{item.quantity}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[#e2e2e8] text-sm font-semibold leading-tight">{item.menuItemName}</div>
                {item.selectedModifiers.length > 0 && (
                  <div className="text-[11px] text-[#4a4a58] mt-0.5 leading-snug">
                    {item.selectedModifiers.map((m) => m.name).join(', ')}
                  </div>
                )}
                {item.notes && (
                  <div className="text-[11px] text-amber-500/70 mt-0.5 italic flex items-start gap-1">
                    <span>⚠</span> {item.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action button */}
        {col.next ? (
          <button
            onClick={() => onAction(order.id, col.next!)}
            className="btn-press w-full py-2.5 rounded-xl text-xs font-display font-bold transition-all"
            style={{
              background:   `${col.color}18`,
              color:         col.color,
              border:        `1px solid ${col.color}35`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${col.color}28`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${col.color}18`; }}
          >
            {col.action} →
          </button>
        ) : (
          <div
            className="text-center text-xs font-semibold py-2 rounded-xl"
            style={{ background: col.glow, color: col.color }}
          >
            ✓ Awaiting driver
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kitchen Page ─────────────────────────────────────

export default function KitchenPage() {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [paused,  setPaused]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [now,     setNow]     = useState(Date.now());
  const logout = useKitchenStore((s) => s.logout);
  const router = useRouter();

  // Tick every minute to refresh timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const playAlert = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [880, 660, 880].forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.15);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.15);
      });
    } catch {}
  }, []);

  useEffect(() => {
    kitchenApi.getQueue().then((res) => setOrders(res.data.data)).finally(() => setLoading(false));
  }, []);

  useKitchenSSE({
    ORDER_CREATED: (data: any) => {
      setOrders((prev) => [data, ...prev]);
      playAlert();
      toast('🆕 New order!', {
        style: { background: '#1a1400', color: '#fbbf24', border: '1px solid #f59e0b40' },
        duration: 6000,
      });
    },
    ORDER_UPDATED: (data: any) => {
      setOrders((prev) =>
        prev
          .map((o) => (o.id === data.orderId ? { ...o, status: data.status } : o))
          .filter((o) => ['pending', 'preparing', 'ready'].includes(o.status))
      );
    },
    ORDERS_PAUSED: (data: any) => setPaused(data.paused),
  });

  const handleStatus = async (orderId: string, status: string) => {
    try {
      await kitchenApi.setStatus(orderId, status);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handlePause = async () => {
    try {
      await kitchenApi.pauseOrders(!paused);
      setPaused((p) => !p);
    } catch {
      toast.error('Failed to toggle');
    }
  };

  const grouped = {
    pending:   orders.filter((o) => o.status === 'pending'),
    preparing: orders.filter((o) => o.status === 'preparing'),
    ready:     orders.filter((o) => o.status === 'ready'),
  };

  // Urgent count (orders >10 min old)
  const urgentCount = orders.filter((o) => {
    const mins = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return mins >= 10 && o.status !== 'ready';
  }).length;

  return (
    <div className="min-h-screen bg-[#060607] text-[#f2f2f5] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-2xl">
            🧀
          </div>
          <div>
            <h1 className="font-display font-black text-xl text-[#f2f2f5]">Kitchen Display</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={clsx('w-1.5 h-1.5 rounded-full', paused ? 'bg-red-400' : 'bg-emerald-400 pulse-dot')} />
              <span className="text-[#4a4a58] text-xs">
                {paused ? 'Paused' : `${orders.length} active`}
              </span>
              {urgentCount > 0 && (
                <span className="text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-full animate-pulse">
                  ⚠ {urgentCount} urgent
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePause}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-display font-bold transition-all border',
              paused
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25'
                : 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
            )}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={() => { logout(); router.push('/kitchen/login'); }}
            className="p-2 rounded-xl text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Paused banner */}
      {paused && (
        <div className="mb-5 p-4 rounded-2xl bg-red-500/8 border border-red-500/20 text-center">
          <span className="text-red-400 text-sm font-semibold">⏸ Orders paused — no new orders being accepted</span>
        </div>
      )}

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="skeleton h-5 w-28 rounded-lg mb-4" />
              {[...Array(2)].map((_, j) => <div key={j} className="skeleton h-44 rounded-2xl" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {(Object.keys(COLS) as Array<keyof typeof COLS>).map((status) => {
            const col = COLS[status];
            const colOrders = grouped[status];
            return (
              <div key={status}>
                {/* Column header */}
                <div
                  className="flex items-center gap-2.5 mb-4 px-1 pb-3 border-b"
                  style={{ borderColor: col.border }}
                >
                  <span className={clsx('w-2 h-2 rounded-full pulse-dot', col.dot)} />
                  <span
                    className="font-display font-black text-[12px] uppercase tracking-widest"
                    style={{ color: col.color }}
                  >
                    {col.label}
                  </span>
                  <div
                    className="ml-auto font-mono text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${col.color}15`,
                      color:       col.color,
                      border:      `1px solid ${col.color}30`,
                    }}
                  >
                    {colOrders.length}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3">
                  {colOrders.map((order, idx) => (
                    <div key={order.id} style={{ animationDelay: `${idx * 60}ms` }}>
                      <OrderCard order={order} col={col} onAction={handleStatus} />
                    </div>
                  ))}

                  {colOrders.length === 0 && (
                    <div
                      className="rounded-2xl border border-dashed p-10 text-center"
                      style={{ borderColor: col.border }}
                    >
                      <div className="text-3xl mb-2 opacity-15">
                        {status === 'pending' ? '🕐' : status === 'preparing' ? '👨‍🍳' : '✅'}
                      </div>
                      <p className="text-[#2e2e38] text-xs font-medium">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
