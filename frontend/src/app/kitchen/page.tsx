'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { kitchenApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { clsx } from 'clsx';
import {
  LogOut, Volume2, VolumeX, Clock, History,
  ChefHat, CheckCircle2, Search, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────

interface OrderItem {
  id: string;
  menuItemName: string;
  quantity: number;
  selectedModifiers: { name: string; priceAdjustment?: number }[];
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  updatedAt?: string;
  customer?: { name: string };
}

// ─── Aging config ─────────────────────────────────────
// Returns card style based on elapsed minutes

function getAgingStyle(createdAt: string): {
  borderColor: string;
  shadowColor: string;
  headerBg: string;
  timerColor: string;
  pulse: boolean;
} {
  const mins = (Date.now() - new Date(createdAt).getTime()) / 60000;

  if (mins >= 15) return {
    borderColor: '#ef4444',
    shadowColor: 'rgba(239,68,68,0.25)',
    headerBg:    'rgba(239,68,68,0.12)',
    timerColor:  '#ef4444',
    pulse:       true,
  };
  if (mins >= 10) return {
    borderColor: '#f97316',
    shadowColor: 'rgba(249,115,22,0.22)',
    headerBg:    'rgba(249,115,22,0.10)',
    timerColor:  '#f97316',
    pulse:       false,
  };
  if (mins >= 5) return {
    borderColor: '#f59e0b',
    shadowColor: 'rgba(245,158,11,0.20)',
    headerBg:    'rgba(245,158,11,0.08)',
    timerColor:  '#f59e0b',
    pulse:       false,
  };
  return {
    borderColor: '#2a2a35',
    shadowColor: 'rgba(0,0,0,0.30)',
    headerBg:    'rgba(255,255,255,0.03)',
    timerColor:  '#6a6a78',
    pulse:       false,
  };
}

// ─── MM:SS Live Timer ─────────────────────────────────

function LiveTimer({ createdAt, color }: { createdAt: string; color: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calc = () => Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    setElapsed(calc());
    const t = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(t);
  }, [createdAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div
      className="font-mono font-black text-[15px] tabular-nums leading-none"
      style={{ color }}
    >
      {mm}:{ss}
    </div>
  );
}

// ─── Column config ────────────────────────────────────

const COLS = {
  pending: {
    label:       'PENDING ORDERS',
    accent:      '#3b82f6',
    glow:        'rgba(59,130,246,0.18)',
    border:      'rgba(59,130,246,0.35)',
    dot:         'bg-blue-400',
    badgeBg:     'rgba(59,130,246,0.15)',
    next:        'preparing' as const,
    action:      'Start Cooking',
    actionColor: '#3b82f6',
    emptyIcon:   '🕐',
  },
  preparing: {
    label:       'PREPARING ORDERS',
    accent:      '#f59e0b',
    glow:        'rgba(245,158,11,0.18)',
    border:      'rgba(245,158,11,0.35)',
    dot:         'bg-amber-400',
    badgeBg:     'rgba(245,158,11,0.15)',
    next:        'ready' as const,
    action:      'Mark as Ready',
    actionColor: '#f59e0b',
    emptyIcon:   '👨‍🍳',
  },
  ready: {
    label:       'READY ORDERS',
    accent:      '#10b981',
    glow:        'rgba(16,185,129,0.18)',
    border:      'rgba(16,185,129,0.35)',
    dot:         'bg-emerald-400',
    badgeBg:     'rgba(16,185,129,0.15)',
    next:        null,
    action:      '',
    actionColor: '#10b981',
    emptyIcon:   '✅',
  },
};

// ─── Order Card ───────────────────────────────────────

function OrderCard({ order, col, onAction, soundEnabled }: {
  order: Order;
  col: typeof COLS[keyof typeof COLS];
  onAction: (id: string, status: string, isReady: boolean) => void;
  soundEnabled: boolean;
}) {
  const aging = getAgingStyle(order.createdAt);
  const [acting, setActing] = useState(false);

  const handleAction = async () => {
    if (!col.next) return;
    setActing(true);
    await onAction(order.id, col.next, col.next === 'ready');
    setActing(false);
  };

  return (
    <div
      className={clsx('rounded-2xl overflow-hidden', aging.pulse && 'animate-pulse-border')}
      style={{
        background:   '#13131a',
        border:       `1.5px solid ${aging.borderColor}`,
        boxShadow:    `0 4px 24px ${aging.shadowColor}, 0 1px 0 rgba(255,255,255,0.04) inset`,
      }}
    >
      {/* Colored top bar matching column */}
      <div
        className="h-[3px]"
        style={{ background: `linear-gradient(90deg, ${col.accent}, ${col.accent}50, transparent)` }}
      />

      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: aging.headerBg }}
      >
        <div>
          <div className="font-mono font-black text-white text-[15px] tracking-tight">
            {order.orderNumber}
          </div>
          {order.customer?.name && (
            <div className="text-[11px] font-medium mt-0.5" style={{ color: col.accent }}>
              {order.customer.name}
            </div>
          )}
        </div>

        {/* Circular timer visual */}
        <div className="flex flex-col items-center gap-0.5">
          <LiveTimer createdAt={order.createdAt} color={aging.timerColor} />
          <div className="text-[9px] text-[#3a3a48] font-medium uppercase tracking-wider">elapsed</div>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2.5">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex gap-3">
            <div
              className="font-mono font-black text-[13px] leading-tight flex-shrink-0 w-6 text-right"
              style={{ color: col.accent }}
            >
              {item.quantity}x
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-[13px] leading-snug">
                {item.menuItemName}
              </div>
              {item.selectedModifiers.length > 0 && (
                <div className="text-[11px] text-[#5a5a68] mt-0.5 leading-snug">
                  {item.selectedModifiers.map((m) => m.name).join(' · ')}
                </div>
              )}
              {item.notes && (
                <div className="text-[11px] text-amber-400/80 mt-0.5 italic">
                  ⚠ {item.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Status label + action */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#3a3a48]">
            Status:
          </div>
          <div
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${col.accent}18`, color: col.accent, border: `1px solid ${col.accent}35` }}
          >
            {order.status === 'pending'   ? 'New'
             : order.status === 'preparing' ? 'Preparing'
             : 'Ready for Pickup'}
          </div>
        </div>

        {col.next ? (
          <button
            onClick={handleAction}
            disabled={acting}
            className="w-full py-2.5 rounded-xl font-bold text-[12px] tracking-wide transition-all disabled:opacity-60 active:scale-[0.98]"
            style={{
              background: `${col.actionColor}22`,
              color:       col.actionColor,
              border:      `1.5px solid ${col.actionColor}45`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${col.actionColor}35`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${col.actionColor}22`; }}
          >
            {acting ? '...' : col.action + ' →'}
          </button>
        ) : (
          <div
            className="w-full py-2.5 rounded-xl text-center text-[12px] font-bold"
            style={{ background: `${col.accent}12`, color: col.accent }}
          >
            ✓ Awaiting Driver
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Card ─────────────────────────────────────

function HistoryCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);

  const startTime = new Date(order.createdAt).getTime();
  const endTime   = order.updatedAt ? new Date(order.updatedAt).getTime() : Date.now();
  const totalSecs = Math.floor((endTime - startTime) / 1000);
  const totalMins = Math.floor(totalSecs / 60);
  const totalSs   = totalSecs % 60;

  const isCompleted = order.status === 'completed';
  const isCancelled = order.status === 'cancelled';

  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{
        background:   '#13131a',
        borderColor:  isCompleted ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.20)',
        boxShadow:    `0 2px 16px ${isCompleted ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}`,
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: isCompleted ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color:       isCompleted ? '#10b981' : '#ef4444',
            }}
          >
            {isCompleted ? '✓' : '✕'}
          </div>
          <div>
            <div className="font-mono font-black text-white text-[13px]">{order.orderNumber}</div>
            <div className="text-[10px] text-[#4a4a58]">
              {new Date(order.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="font-mono text-[11px] text-[#4a4a58]">
              {String(totalMins).padStart(2, '0')}:{String(totalSs).padStart(2, '0')} total
            </div>
            <div
              className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 inline-block"
              style={{
                background: isCompleted ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color:       isCompleted ? '#10b981' : '#ef4444',
              }}
            >
              {order.status}
            </div>
          </div>
          <div className="text-[#3a3a48] text-xs">{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#1e1e22] pt-3 space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="font-mono font-black text-[12px] text-[#4a4a58] w-5 text-right flex-shrink-0">
                {item.quantity}x
              </div>
              <div className="flex-1">
                <div className="text-[#d4d4dc] text-[12px] font-semibold">{item.menuItemName}</div>
                {item.selectedModifiers.length > 0 && (
                  <div className="text-[10px] text-[#4a4a58] mt-0.5">
                    {item.selectedModifiers.map((m) => m.name).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sound engine ─────────────────────────────────────

function useSound() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('kitchen_sound') !== 'off';
  });

  const toggle = () => {
    setEnabled((v) => {
      const next = !v;
      localStorage.setItem('kitchen_sound', next ? 'on' : 'off');
      return next;
    });
  };

  const playBeep = useCallback(() => {
    if (!enabled) return;
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const seq  = [880, 660, 880];
      seq.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.15);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.18);
      });
    } catch {}
  }, [enabled]);

  const playSwoosh = useCallback(() => {
    if (!enabled) return;
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, [enabled]);

  return { enabled, toggle, playBeep, playSwoosh };
}

// ─── History Tab ─────────────────────────────────────

function HistoryTab() {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    kitchenApi.getHistory()
      .then((res) => setOrders(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchSearch = !search || o.orderNumber.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a58]" />
          <input
            className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#13131a] border border-[#222228] text-[#f2f2f5] text-sm placeholder:text-[#3a3a48] outline-none focus:border-amber-500/40"
            placeholder="Search order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {(['all', 'completed', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold border transition-all capitalize',
              statusFilter === s
                ? s === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : s === 'cancelled' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-transparent text-[#4a4a58] border-[#222228] hover:border-[#333340]'
            )}
          >
            {s}
          </button>
        ))}
        <span className="text-[11px] text-[#3a3a48]">{filtered.length} orders</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <History size={36} className="mx-auto text-[#2a2a30] mb-3" />
          <div className="text-[#3a3a48] font-semibold">No orders found</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((order) => (
            <HistoryCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  KITCHEN PAGE
// ═══════════════════════════════════════════════════════

export default function KitchenPage() {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [paused,  setPaused]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'live' | 'history'>('live');
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const { enabled: soundEnabled, toggle: toggleSound, playBeep, playSwoosh } = useSound();

  useEffect(() => {
    kitchenApi.getQueue()
      .then((res) => setOrders(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  useSSE({
    onEvent: {
      ORDER_CREATED: (data: any) => {
        setOrders((prev) => [data, ...prev]);
        playBeep();
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
    },
  });

  const handleStatus = useCallback(async (orderId: string, status: string, isReady: boolean) => {
    try {
      await kitchenApi.setStatus(orderId, status);
      if (isReady) playSwoosh();
    } catch {
      toast.error('Failed to update status');
    }
  }, [playSwoosh]);

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

  const urgentCount = orders.filter((o) => {
    const mins = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return mins >= 10 && o.status !== 'ready';
  }).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f2f2f5]">

      {/* ── Top Bar ─────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-[#1a1a22]"
        style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)' }}
      >
        {/* Left: logo + status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-lg">
              🧀
            </div>
            <div>
              <div className="font-display font-black text-white text-[14px] leading-tight">Kitchen Display</div>
              <div className="flex items-center gap-1.5">
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', paused ? 'bg-red-400' : 'bg-emerald-400')} />
                <span className="text-[10px] text-[#4a4a58]">
                  {paused ? 'Paused' : `${orders.length} active order${orders.length !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>

          {urgentCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/12 border border-red-500/25 animate-pulse">
              <span className="text-red-400 text-[11px] font-bold">⚠ {urgentCount} urgent</span>
            </div>
          )}
        </div>

        {/* Center: Pause toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#4a4a58] font-semibold">Pause Orders</span>
          <button
            onClick={handlePause}
            className={clsx(
              'relative w-12 h-6 rounded-full transition-colors',
              paused ? 'bg-red-500' : 'bg-[#2a2a35]'
            )}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all"
              style={{ left: paused ? '26px' : '2px' }}
            />
          </button>
        </div>

        {/* Right: Sound + logout */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all',
              soundEnabled
                ? 'bg-blue-500/12 text-blue-400 border-blue-500/25 hover:bg-blue-500/20'
                : 'bg-[#1a1a22] text-[#4a4a58] border-[#222228] hover:border-[#333340]'
            )}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            {soundEnabled ? 'Sound On' : 'Sound Off'}
          </button>
          <button
            onClick={() => { logout(); router.push('/kitchen/login'); }}
            className="p-2 rounded-xl text-[#4a4a58] hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* ── Paused banner ────────────────────────────── */}
      {paused && (
        <div className="mx-6 mt-4 p-3 rounded-2xl bg-red-500/8 border border-red-500/20 text-center">
          <span className="text-red-400 text-sm font-semibold">⏸ Orders paused — not accepting new orders</span>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-6 pt-5 pb-0">
        <button
          onClick={() => setTab('live')}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
            tab === 'live'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
              : 'text-[#4a4a58] hover:text-[#9898a5] border border-transparent'
          )}
        >
          <ChefHat size={14} />
          Live Orders
          {orders.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center justify-center">
              {orders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
            tab === 'history'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
              : 'text-[#4a4a58] hover:text-[#9898a5] border border-transparent'
          )}
        >
          <History size={14} />
          Order History
        </button>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="p-6 pt-4">
        {tab === 'history' ? (
          <HistoryTab />
        ) : loading ? (
          <div className="grid grid-cols-3 gap-5 mt-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="skeleton h-6 w-36 rounded-lg mb-4" />
                {[...Array(2)].map((_, j) => <div key={j} className="skeleton h-52 rounded-2xl" />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5 mt-2">
            {(Object.keys(COLS) as Array<keyof typeof COLS>).map((status) => {
              const col = COLS[status];
              const colOrders = grouped[status];
              return (
                <div key={status}>
                  {/* Column header */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <div
                      className="font-display font-black text-[13px] tracking-[0.12em]"
                      style={{ color: col.accent }}
                    >
                      {col.label}
                    </div>
                    <div
                      className="ml-auto w-7 h-7 rounded-full flex items-center justify-center font-mono font-black text-[12px]"
                      style={{
                        background: `${col.accent}18`,
                        color:       col.accent,
                        border:      `1.5px solid ${col.accent}35`,
                      }}
                    >
                      {colOrders.length}
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    className="h-[2px] rounded-full mb-4"
                    style={{ background: `linear-gradient(90deg, ${col.accent}60, transparent)` }}
                  />

                  {/* Cards */}
                  <div className="flex flex-col gap-3">
                    {colOrders.map((order, idx) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        col={col}
                        onAction={handleStatus}
                        soundEnabled={soundEnabled}
                      />
                    ))}

                    {colOrders.length === 0 && (
                      <div
                        className="rounded-2xl border border-dashed p-10 text-center"
                        style={{ borderColor: `${col.accent}25` }}
                      >
                        <div className="text-4xl mb-2 opacity-20">{col.emptyIcon}</div>
                        <p className="text-[#2a2a35] text-xs font-medium">Empty</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
