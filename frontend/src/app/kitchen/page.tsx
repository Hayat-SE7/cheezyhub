'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kitchenApi } from '@/lib/api';
import { useKitchenSSE } from '@/hooks/useKitchenSSE';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { UtensilsCrossed } from 'lucide-react';

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
  orderType: 'delivery' | 'counter' | 'dine_in';
  items: OrderItem[];
  total: number;
  createdAt: string;
  customer?: { name: string };
}

const STATUS_CONFIG = {
  pending: {
    label: 'New',
    color: '#f59e0b',
    stripClass: 'border-t-4 border-amber-500',
    actionLabel: 'Start Cooking',
    actionClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25',
    next: 'preparing' as const,
    badgeClass: 'bg-amber-500/15 text-amber-400',
  },
  preparing: {
    label: 'Cooking',
    color: '#3b82f6',
    stripClass: 'border-t-4 border-blue-500',
    actionLabel: 'Mark Ready',
    actionClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25',
    next: 'ready' as const,
    badgeClass: 'bg-blue-500/15 text-blue-400',
  },
  ready: {
    label: 'Ready',
    color: '#10b981',
    stripClass: 'border-t-4 border-emerald-500',
    actionLabel: '',
    actionClass: '',
    next: null,
    badgeClass: 'bg-emerald-500/15 text-emerald-400',
  },
} as const;

function useElapsedTime(createdAt: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
    update();
    const t = setInterval(update, 10000);
    return () => clearInterval(t);
  }, [createdAt]);
  const mins = Math.floor(elapsed / 60);
  const label = mins < 1 ? 'Just now' : mins === 1 ? '1 min' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  const urgency = mins >= 15 ? 'critical' : mins >= 8 ? 'warning' : 'ok';
  return { label, urgency };
}

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const { label, urgency } = useElapsedTime(createdAt);
  return (
    <span className={clsx(
      'tabular text-sm font-bold font-mono',
      urgency === 'critical' ? 'text-red-400 animate-pulse' :
      urgency === 'warning'  ? 'text-amber-400' :
                               'text-[#4A4A58]'
    )}>
      {label}
    </span>
  );
}

function OrderCard({ order, onAction }: { order: Order; onAction: (id: string, status: string) => void }) {
  const cfg = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;

  return (
    <div className={clsx('bg-[#0F0F14] border border-[#1E1E28] rounded-2xl overflow-hidden min-h-[160px] flex flex-col', cfg.stripClass)}>
      {/* Header */}
      <div className="p-4 pb-2 flex items-start justify-between">
        <div>
          <div className="text-xl font-black text-[#F2F2F5] leading-tight">{order.orderNumber}</div>
          {order.customer?.name && (
            <div className="text-xs text-[#4A4A58] mt-0.5">{order.customer.name}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ElapsedTimer createdAt={order.createdAt} />
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.badgeClass)}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 pb-3 flex-1 space-y-2">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex gap-2.5">
            <span className="text-sm font-black leading-tight flex-shrink-0 min-w-[24px]" style={{ color: cfg.color }}>
              ×{item.quantity}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#F2F2F5] leading-tight">{item.menuItemName}</div>
              {item.selectedModifiers?.length > 0 && (
                <div className="text-xs text-[#4A4A58] mt-0.5">{item.selectedModifiers.map((m) => m.name).join(', ')}</div>
              )}
              {item.notes && (
                <div className="text-xs text-amber-400/70 mt-0.5 italic">⚠ {item.notes}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="px-4 pb-4">
        {cfg.next ? (
          <button
            onClick={() => onAction(order.id, cfg.next!)}
            className={clsx('w-full py-3 rounded-xl text-sm font-bold transition-all', cfg.actionClass)}
          >
            {cfg.actionLabel} →
          </button>
        ) : (
          <div className={clsx('text-center text-xs font-semibold py-3 rounded-xl', cfg.actionClass || 'bg-emerald-500/10 text-emerald-400')}>
            {order.orderType === 'delivery' ? '✓ Awaiting driver' : '✓ Ready for pickup'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const [paused, setPaused] = useState(false);

  const { data: orders = [], isLoading: loading } = useQuery<Order[]>({
    queryKey: ['kitchen-queue'],
    queryFn: async () => {
      const res = await kitchenApi.getQueue();
      return res.data.data;
    },
  });

  const playAlert = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [880, 660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
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

  useKitchenSSE({
    ORDER_CREATED: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-queue'] });
      playAlert();
      toast('New order!', { duration: 6000, icon: '🆕' });
    },
    ORDER_UPDATED: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-queue'] });
    },
    ORDERS_PAUSED: (data: any) => setPaused(data.paused),
  });

  const handleStatus = async (orderId: string, status: string) => {
    try { await kitchenApi.setStatus(orderId, status); }
    catch { toast.error('Failed to update status'); }
  };

  const handlePause = async () => {
    try { await kitchenApi.pauseOrders(!paused); setPaused((p) => !p); }
    catch { toast.error('Failed to toggle'); }
  };

  // Sort: pending → preparing → ready, then by createdAt (oldest first)
  const sortedOrders = useMemo(() => {
    const statusOrder = { pending: 0, preparing: 1, ready: 2 };
    return [...orders].sort((a, b) => {
      const sd = (statusOrder[a.status as keyof typeof statusOrder] ?? 3) - (statusOrder[b.status as keyof typeof statusOrder] ?? 3);
      if (sd !== 0) return sd;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [orders]);

  const pendingCount  = orders.filter((o) => o.status === 'pending').length;
  const cookingCount  = orders.filter((o) => o.status === 'preparing').length;
  const readyCount    = orders.filter((o) => o.status === 'ready').length;
  const urgentCount   = orders.filter((o) => {
    const mins = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return mins >= 15 && o.status !== 'ready';
  }).length;

  return (
    <div className="text-[#F2F2F5] p-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 px-1">
        <div className="text-xs text-[#4A4A58]">
          New: <span className="text-amber-400 font-bold">{pendingCount}</span>
        </div>
        <div className="text-xs text-[#4A4A58]">
          Cooking: <span className="text-blue-400 font-bold">{cookingCount}</span>
        </div>
        <div className="text-xs text-[#4A4A58]">
          Ready: <span className="text-emerald-400 font-bold">{readyCount}</span>
        </div>
        {urgentCount > 0 && (
          <span className="text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-full animate-pulse ml-auto">
            ⚠ {urgentCount} urgent
          </span>
        )}
        <button
          onClick={handlePause}
          className={clsx('px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ml-auto', urgentCount > 0 && 'ml-0', paused
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25'
            : 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
          )}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      {paused && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/8 border border-red-500/20 text-center">
          <span className="text-red-400 text-sm font-semibold">⏸ Orders paused — not accepting new orders</span>
        </div>
      )}

      {/* Card wall */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-[#0F0F14] animate-pulse border border-[#1E1E28]" />
          ))}
        </div>
      ) : sortedOrders.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="Kitchen is clear" description="No active orders right now." dark className="py-20" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedOrders.map((order) => (
            <OrderCard key={order.id} order={order} onAction={handleStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
