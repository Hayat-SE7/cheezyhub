'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }             from 'next/navigation';
import { counterApi }            from '@/lib/api';
import { useCounterStore }       from '@/store/counterStore';
import { useOfflineQueueStore }  from '@/store/offlineQueueStore';
import { useOnlineStatus }       from '@/hooks/useOnlineStatus';
import { drainQueue }            from '@/lib/syncQueue';
import {
  Timer, TrendingUp, Package, Wallet,
  Play, StopCircle, WifiOff, RefreshCw,
  ArrowLeft, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { clsx }                  from 'clsx';
import { formatDistanceToNow }   from 'date-fns';
import toast                     from 'react-hot-toast';

interface Shift {
  id:           string;
  startedAt:    string;
  endedAt?:     string;
  openingFloat: number;
  closingCash?: number;
  expectedCash?: number;
  discrepancy?: number;
  orderCount:   number;
  totalSales:   number;
  status:       string;
  notes?:       string;
  cashier?:     { username: string };
}

export default function ShiftPage() {
  const router        = useRouter();
  const { theme }     = useCounterStore();
  const offlineQueue  = useOfflineQueueStore();
  const { isOnline, setLastSyncAt } = useOnlineStatus();
  const isDark = theme === 'dark';

  const [shift,        setShift]        = useState<Shift | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [elapsed,      setElapsed]      = useState('');

  // Start shift form
  const [openingFloat, setOpeningFloat] = useState('');

  // End shift form
  const [closingCash, setClosingCash]   = useState('');
  const [shiftNotes,  setShiftNotes]    = useState('');
  const [showEndForm, setShowEndForm]   = useState(false);

  // ── Fetch current shift ─────────────────────────────────────
  const loadShift = useCallback(async () => {
    if (!isOnline) return; // can't fetch when offline
    try {
      const res = await counterApi.getCurrentShift();
      setShift(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => { loadShift(); }, [loadShift]);

  // ── Elapsed timer ───────────────────────────────────────────
  useEffect(() => {
    if (!shift || shift.status !== 'open') return;
    const tick = () => {
      const diff = Date.now() - new Date(shift.startedAt).getTime();
      const h    = Math.floor(diff / 3600000);
      const m    = Math.floor((diff % 3600000) / 60000);
      const s    = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shift]);

  // ── Start shift ─────────────────────────────────────────────
  const handleStartShift = async () => {
    const float = parseFloat(openingFloat) || 0;
    setSubmitting(true);

    if (isOnline) {
      try {
        const res = await counterApi.startShift(float);
        setShift(res.data.data);
        toast.success('Shift started ✓');
        setOpeningFloat('');

        // Tier 1: Cache warm — pre-fetch menu immediately on shift start
        counterApi.getMenu().catch(() => {});

      } catch (err: any) {
        toast.error(err?.response?.data?.error ?? 'Failed to start shift');
      }
    } else {
      // Queue shift_start offline
      const localId = await offlineQueue.enqueue({
        type:       'shift_start',
        endpoint:   '/counter/shift/start',
        method:     'POST',
        payload:    { openingFloat: float },
        localLabel: `Shift Start — Float Rs.${float}`,
      });

      if (localId === null) {
        toast.error('Offline queue is full');
      } else {
        toast('Shift start queued — will sync when online', { icon: '🕐', duration: 3500 });
        // Create an optimistic local shift object so the UI isn't blank
        setShift({
          id:           localId,
          startedAt:    new Date().toISOString(),
          openingFloat: float,
          orderCount:   0,
          totalSales:   0,
          status:       'open',
        });
        setOpeningFloat('');

        // Cache warm even when offline (SW serves from existing cache)
        counterApi.getMenu().catch(() => {});
      }
    }
    setSubmitting(false);
  };

  // ── End shift ───────────────────────────────────────────────
  const handleEndShift = async () => {
    const cash = parseFloat(closingCash);
    if (isNaN(cash) || cash < 0) {
      toast.error('Enter a valid closing cash amount');
      return;
    }
    setSubmitting(true);

    if (isOnline) {
      try {
        const res = await counterApi.endShift(cash, shiftNotes || undefined);
        setShift(res.data.data);
        setShowEndForm(false);
        toast.success('Shift closed ✓');
        setClosingCash('');
        setShiftNotes('');
      } catch (err: any) {
        toast.error(err?.response?.data?.error ?? 'Failed to end shift');
      }
    } else {
      // Queue shift_end offline
      const localId = await offlineQueue.enqueue({
        type:       'shift_end',
        endpoint:   '/counter/shift/end',
        method:     'POST',
        payload:    { closingCash: cash, notes: shiftNotes || undefined },
        localLabel: `Shift End — Closing Rs.${cash}`,
      });

      if (localId === null) {
        toast.error('Offline queue is full');
      } else {
        toast('Shift end queued — will sync when online', { icon: '🕐', duration: 3500 });
        setShift((prev) => prev ? { ...prev, status: 'closed', closingCash: cash } : null);
        setShowEndForm(false);
        setClosingCash('');
        setShiftNotes('');
      }
    }
    setSubmitting(false);
  };

  // ── Styles ──────────────────────────────────────────────────
  const surface  = isDark ? 'bg-[#0c0c0f] border-[#1e1e28]' : 'bg-white border-[#ece6dc]';
  const surface2 = isDark ? 'bg-[#111116] border-[#1e1e28]' : 'bg-[#faf9f6] border-[#ece6dc]';
  const textMut  = isDark ? 'text-[#4a4a58]' : 'text-[#a39083]';
  const inputCls = isDark
    ? 'bg-[#0f0f14] border-[#2a2a35] text-[#f2f2f5] placeholder:text-[#3a3a48] focus:border-amber-500/50'
    : 'bg-white border-[#e8e3da] text-[#1c1714] placeholder:text-[#c4b8ac] focus:border-amber-400/60';

  const statCard = (icon: React.ReactNode, label: string, value: string, sub?: string) => (
    <div className={clsx('p-4 rounded-2xl border', surface2)}>
      <div className={clsx('flex items-center gap-2 mb-2', textMut)}>
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="font-bold text-lg leading-tight">{value}</p>
      {sub && <p className={clsx('text-[11px] mt-0.5', textMut)}>{sub}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={20} className="animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">

      {/* Back button */}
      <button
        onClick={() => router.push('/counter')}
        className={clsx('flex items-center gap-1.5 text-xs font-semibold mb-2', textMut, 'hover:text-amber-400 transition-colors')}
      >
        <ArrowLeft size={13} /> Back to POS
      </button>

      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <WifiOff size={13} />
          <span>Offline — shift actions will be queued and synced automatically.</span>
        </div>
      )}

      {/* ── No shift: Start shift form ──────────────────────── */}
      {(!shift || shift.status === 'closed') && (
        <div className={clsx('rounded-2xl border p-5', surface)}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Play size={15} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Start Shift</h2>
              <p className={clsx('text-xs', textMut)}>Enter your opening cash float</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className={clsx('block text-xs font-semibold mb-1.5', textMut)}>
                Opening Float (Rs.)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                className={clsx(
                  'w-full px-4 py-3 rounded-xl border text-sm font-semibold outline-none transition-colors',
                  inputCls
                )}
                placeholder="0"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartShift()}
              />
              <p className={clsx('text-[11px] mt-1', textMut)}>
                This is the cash in the drawer before any sales
              </p>
            </div>

            <button
              onClick={handleStartShift}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {submitting
                ? <RefreshCw size={14} className="animate-spin" />
                : <Play size={14} />
              }
              {isOnline ? 'Start Shift' : 'Queue Shift Start'}
            </button>
          </div>
        </div>
      )}

      {/* ── Active shift ────────────────────────────────────── */}
      {shift && shift.status === 'open' && (
        <>
          {/* Status header */}
          <div className={clsx('rounded-2xl border p-4', surface)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-sm text-emerald-400">Shift Active</span>
              </div>
              <span className={clsx('font-mono text-sm font-bold tracking-wider', isDark ? 'text-[#f2f2f5]' : 'text-[#1c1714]')}>
                {elapsed}
              </span>
            </div>
            <p className={clsx('text-xs', textMut)}>
              Started {formatDistanceToNow(new Date(shift.startedAt), { addSuffix: true })}
              {shift.cashier && ` · ${shift.cashier.username}`}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {statCard(<TrendingUp size={13} />, 'Total Sales', `Rs.${shift.totalSales.toFixed(0)}`)}
            {statCard(<Package size={13} />, 'Orders', `${shift.orderCount}`,
              shift.orderCount > 0
                ? `Avg Rs.${(shift.totalSales / shift.orderCount).toFixed(0)}`
                : undefined
            )}
            {statCard(<Wallet size={13} />, 'Opening Float', `Rs.${shift.openingFloat.toFixed(0)}`)}
            {statCard(<Timer size={13} />, 'Expected Cash', `Rs.${(shift.openingFloat + shift.totalSales).toFixed(0)}`, 'Float + cash sales')}
          </div>

          {/* Pending queue count */}
          {offlineQueue.pendingCount() > 0 && (
            <div className={clsx('flex items-center justify-between px-4 py-3 rounded-2xl border text-xs', surface2)}>
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle size={13} />
                <span>{offlineQueue.pendingCount()} item{offlineQueue.pendingCount() > 1 ? 's' : ''} waiting to sync</span>
              </div>
              {isOnline && (
                <button
                  onClick={() => drainQueue(setLastSyncAt)}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Sync now
                </button>
              )}
            </div>
          )}

          {/* End shift */}
          {!showEndForm ? (
            <button
              onClick={() => setShowEndForm(true)}
              className={clsx(
                'w-full py-3 rounded-2xl border font-bold text-sm transition-all flex items-center justify-center gap-2',
                isDark
                  ? 'border-red-900/50 text-red-400 hover:bg-red-900/20 hover:border-red-800'
                  : 'border-red-200 text-red-500 hover:bg-red-50'
              )}
            >
              <StopCircle size={14} /> End Shift
            </button>
          ) : (
            <div className={clsx('rounded-2xl border p-5', surface)}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <StopCircle size={15} className="text-red-400" />
                </div>
                <div>
                  <h2 className="font-bold text-sm">End Shift</h2>
                  <p className={clsx('text-xs', textMut)}>Count your closing cash</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={clsx('block text-xs font-semibold mb-1.5', textMut)}>
                    Closing Cash (Rs.) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    className={clsx('w-full px-4 py-3 rounded-xl border text-sm font-semibold outline-none transition-colors', inputCls)}
                    placeholder="Physical cash in drawer"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                  />
                </div>

                {/* Discrepancy preview */}
                {closingCash !== '' && !isNaN(parseFloat(closingCash)) && (
                  <div className={clsx('flex items-center justify-between px-3 py-2 rounded-xl', surface2)}>
                    <span className={clsx('text-xs', textMut)}>Expected</span>
                    <span className="text-xs font-bold">
                      Rs.{(shift.openingFloat + shift.totalSales).toFixed(0)}
                    </span>
                  </div>
                )}
                {closingCash !== '' && !isNaN(parseFloat(closingCash)) && (() => {
                  const expected = shift.openingFloat + shift.totalSales;
                  const disc     = parseFloat(closingCash) - expected;
                  const isOver   = disc > 0;
                  return (
                    <div className={clsx(
                      'flex items-center justify-between px-3 py-2 rounded-xl',
                      disc === 0
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : isOver
                          ? 'bg-blue-500/10 border border-blue-500/20'
                          : 'bg-red-500/10 border border-red-500/20'
                    )}>
                      <span className={clsx('text-xs font-semibold',
                        disc === 0 ? 'text-emerald-400' : isOver ? 'text-blue-400' : 'text-red-400'
                      )}>
                        {disc === 0 ? '✓ Exact' : isOver ? 'Over by' : 'Short by'}
                      </span>
                      {disc !== 0 && (
                        <span className={clsx('text-xs font-bold',
                          isOver ? 'text-blue-400' : 'text-red-400'
                        )}>
                          Rs.{Math.abs(disc).toFixed(0)}
                        </span>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className={clsx('block text-xs font-semibold mb-1.5', textMut)}>Notes (optional)</label>
                  <textarea
                    rows={2}
                    className={clsx('w-full px-4 py-3 rounded-xl border text-xs resize-none outline-none transition-colors', inputCls)}
                    placeholder="Any discrepancy notes..."
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowEndForm(false); setClosingCash(''); setShiftNotes(''); }}
                    className={clsx('flex-1 py-2.5 rounded-xl text-xs border font-semibold transition-colors',
                      isDark ? 'border-[#2a2a35] text-[#4a4a58] hover:text-[#f2f2f5]' : 'border-[#e8e3da] text-[#a39083]'
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEndShift}
                    disabled={submitting || !closingCash}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {submitting
                      ? <RefreshCw size={12} className="animate-spin" />
                      : <StopCircle size={12} />
                    }
                    {isOnline ? 'Close Shift' : 'Queue Close'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Closed shift summary ─────────────────────────────── */}
      {shift && shift.status === 'closed' && shift.closingCash !== undefined && (
        <div className={clsx('rounded-2xl border p-5', surface)}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <h2 className="font-bold text-sm">Shift Closed</h2>
          </div>
          <div className="space-y-2">
            {[
              ['Closing Cash',  `Rs.${shift.closingCash!.toFixed(0)}`],
              ['Expected Cash', `Rs.${shift.expectedCash?.toFixed(0) ?? '—'}`],
              ['Discrepancy',   shift.discrepancy !== undefined
                ? `${shift.discrepancy >= 0 ? '+' : ''}Rs.${shift.discrepancy.toFixed(0)}`
                : '—'
              ],
              ['Total Sales',   `Rs.${shift.totalSales.toFixed(0)}`],
              ['Orders',        `${shift.orderCount}`],
            ].map(([label, value]) => (
              <div key={label} className={clsx('flex justify-between items-center py-2 border-b last:border-0', isDark ? 'border-[#1e1e28]' : 'border-[#f0ece4]')}>
                <span className={clsx('text-xs', textMut)}>{label}</span>
                <span className={clsx('text-xs font-bold', label === 'Discrepancy'
                  ? (parseFloat(value.replace(/[^-\d.]/g,'')) < 0 ? 'text-red-400' : 'text-emerald-400')
                  : ''
                )}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
