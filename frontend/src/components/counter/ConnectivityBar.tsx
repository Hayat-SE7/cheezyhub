'use client';
// ─────────────────────────────────────────────────────────────────
//  ConnectivityBar — Phase 12
//  4-state indicator: online / slow / reconnecting / offline
//  Shows: status pill, last-sync timestamp, queue count,
//         manual sync button, RTT badge.
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { clsx } from 'clsx';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useOfflineQueueStore } from '@/store/offlineQueueStore';
import { drainQueue } from '@/lib/syncQueue';
import { OnlineStatusValue } from '@/hooks/useOnlineStatus';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  status:      OnlineStatusValue;
  rtt:         number | null;
  lastOnlineAt: Date | null;
  isDark:      boolean;
}

export default function ConnectivityBar({ status, rtt, lastOnlineAt, isDark }: Props) {
  const { items, pendingCount, failedCount } = useOfflineQueueStore();
  const [syncing, setSyncing] = useState(false);

  const pending = pendingCount();
  const failed  = failedCount();

  const handleManualSync = async () => {
    if (syncing || status !== 'online') return;
    setSyncing(true);
    try {
      const result = await drainQueue();
      if (result.stopped)        toast.error('Sync stopped — please login again');
      else if (result.created)   toast.success(`✅ ${result.created} order${result.created > 1 ? 's' : ''} synced`);
      else if (result.failed)    toast.error(`${result.failed} item${result.failed > 1 ? 's' : ''} failed to sync`);
      else                       toast('Queue is empty', { icon: '✓' });
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Status config
  const config: Record<OnlineStatusValue, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    online: {
      label: 'Online',
      icon:  <Wifi size={11} />,
      color: isDark ? 'text-emerald-400' : 'text-emerald-600',
      bg:    isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200',
    },
    slow: {
      label: 'Slow',
      icon:  <AlertTriangle size={11} />,
      color: isDark ? 'text-amber-400' : 'text-amber-600',
      bg:    isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200',
    },
    reconnecting: {
      label: 'Reconnecting…',
      icon:  <Loader2 size={11} className="animate-spin" />,
      color: isDark ? 'text-blue-400' : 'text-blue-600',
      bg:    isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200',
    },
    offline: {
      label: 'Offline',
      icon:  <WifiOff size={11} />,
      color: isDark ? 'text-red-400' : 'text-red-600',
      bg:    isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200',
    },
  };

  const c = config[status];

  return (
    <div className="flex items-center gap-2">
      {/* Status pill */}
      <div className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', c.color, c.bg)}>
        {c.icon}
        {c.label}
        {(status === 'online' || status === 'slow') && rtt !== null && (
          <span className="opacity-60 text-[10px]">{rtt}ms</span>
        )}
      </div>

      {/* Queue badge */}
      {(pending > 0 || failed > 0) && (
        <div className={clsx('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border',
          failed > 0
            ? (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200')
            : (isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200')
        )}>
          {failed > 0 ? <AlertTriangle size={10} /> : <RefreshCw size={10} />}
          {failed > 0 ? `${failed} failed` : `${pending} queued`}
        </div>
      )}

      {/* Last sync */}
      {lastOnlineAt && status !== 'online' && (
        <span className={clsx('text-[10px]', isDark ? 'text-[#3a3a48]' : 'text-[#a39083]')}>
          Last sync {formatDistanceToNow(lastOnlineAt, { addSuffix: true })}
        </span>
      )}

      {/* Manual sync button */}
      {pending > 0 && status === 'online' && (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className={clsx(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
            isDark
              ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-40 border border-amber-200'
          )}
        >
          {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      )}
    </div>
  );
}
