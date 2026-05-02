'use client';
// ─────────────────────────────────────────────────────────────────
//  Counter Layout — Phase 12
//  ✅ Service Worker registration + update toast
//  ✅ Offline queue hydration on mount
//  ✅ Auto-sync on reconnect
//  ✅ ConnectivityBar in header
//  ✅ FailedQueueModal trigger
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCounterStore } from '@/store/counterStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueueStore } from '@/store/offlineQueueStore';
import { drainQueue, playBeep } from '@/lib/syncQueue';
import ConnectivityBar from '@/components/counter/ConnectivityBar';
import FailedQueueModal from '@/components/counter/FailedQueueModal';
import { counterApi } from '@/lib/api';
import { LogOut, Timer, AlertCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';

function ShiftBar({ isDark }: { isDark: boolean }) {
  const [shift, setShift]     = useState<any>(null);
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    counterApi.getCurrentShift()
      .then((res) => setShift(res.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!shift) return;
    const tick = () => {
      const diff = Date.now() - new Date(shift.startedAt).getTime();
      const h    = Math.floor(diff / 3600000);
      const m    = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [shift]);

  if (!shift) {
    return (
      <div className={clsx('flex items-center gap-1.5 text-xs px-3 py-1 rounded-full', isDark ? 'bg-amber-500/10 text-amber-400/70' : 'bg-amber-50 text-amber-600/70')}>
        <AlertCircle size={11} /> No active shift
      </div>
    );
  }

  return (
    <div className={clsx('flex items-center gap-1.5 text-xs px-3 py-1 rounded-full', isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700')}>
      <Timer size={11} />
      Shift: {elapsed} · Rs.{shift.totalSales?.toFixed(0) ?? 0} · {shift.orderCount ?? 0} orders
    </div>
  );
}

export default function CounterLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { isAuthenticated, user, logout } = useCounterStore();
  const { status, rtt, lastOnlineAt } = useOnlineStatus();
  const { hydrate, pendingCount, failedCount } = useOfflineQueueStore();
  const [showFailedModal, setShowFailedModal] = useState(false);
  const prevStatus = useRef(status);

  // Auth guard
  useEffect(() => {
    if (pathname === '/counter/login') return;
    const token = Cookies.get('ch_counter_token');
    if (!token || !isAuthenticated) { router.replace('/counter/login'); return; }
    const role = user?.role;
    if (role !== 'cashier' && role !== 'admin') {
      toast.error('Counter access requires a cashier account');
      router.replace('/counter/login');
    }
  }, [isAuthenticated, user, pathname]);

  // Hydrate offline queue from IndexedDB
  useEffect(() => { hydrate(); }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Update available — refresh to apply', {
              duration: 8000,
              icon: '🔄',
            });
          }
        });
      });
    }).catch(() => {});
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (prevStatus.current !== 'online' && status === 'online') {
      playBeep('reconnect');
      const pending = pendingCount();
      if (pending > 0) {
        // Verify token is still valid before draining
        const token = Cookies.get('ch_counter_token');
        if (!token) {
          toast.error('Session expired — log in to sync queued orders');
        } else {
          toast(`Back online — syncing ${pending} queued order${pending > 1 ? 's' : ''}…`, { icon: '🔄', duration: 3000 });
          drainQueue().then((result) => {
            if (result.created > 0) toast.success(`${result.created} order${result.created > 1 ? 's' : ''} synced!`);
            if (result.failed  > 0) toast.error(`${result.failed} failed — tap to review`);
          });
        }
      }
    }

    if (prevStatus.current === 'online' && status === 'offline') {
      playBeep('offline');
      toast('Offline mode — orders will be queued', { icon: '📴', duration: 4000 });
    }

    prevStatus.current = status;
  }, [status]);

  const handleLogout = () => { logout(); Cookies.remove('ch_counter_token'); router.push('/counter/login'); };

  if (pathname === '/counter/login') return <>{children}</>;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#09090E] text-[#F2F2F5]">
      {showFailedModal && <FailedQueueModal isDark={true} onClose={() => setShowFailedModal(false)} />}

      {/* Header */}
      <header className="flex-shrink-0 border-b border-[#1E1E28] flex items-center justify-between px-4 h-12 gap-3 z-40 bg-[#0F0F14]">
        {/* Left: logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm shadow-md shadow-amber-400/30">🧀</div>
          <div>
            <span className="font-bold text-sm text-[#F2F2F5]">CheezyHub</span>
            <span className="text-xs ml-1.5 text-[#4A4A58]">POS</span>
          </div>
        </div>

        {/* Center: shift + connectivity */}
        <div className="flex-1 flex items-center justify-center gap-3">
          <ShiftBar isDark={true} />
          <ConnectivityBar status={status} rtt={rtt} lastOnlineAt={lastOnlineAt} isDark={true} />
          {failedCount() > 0 && (
            <button onClick={() => setShowFailedModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-semibold">
              <AlertTriangle size={11} /> {failedCount()} failed
            </button>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-medium text-[#4A4A58]">
            {user?.username ?? 'Cashier'}
          </span>
          <button onClick={() => router.push('/counter/shift')} className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors bg-[#1A1A22] text-[#9898A5] hover:text-amber-400 hover:bg-amber-500/10">
            Shift
          </button>
          <button onClick={handleLogout} aria-label="Logout" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all text-[#3A3A48] hover:text-red-400 hover:bg-red-500/10">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden"><ErrorBoundary>{children}</ErrorBoundary></main>
    </div>
  );
}
