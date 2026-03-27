'use client';
// ─────────────────────────────────────────────────────────────────
//  FailedQueueModal — Phase 12
//  Shows all failed queue items with error reasons.
//  Actions: Retry All, Clear Failed, Close.
// ─────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { clsx } from 'clsx';
import { X, AlertTriangle, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { useOfflineQueueStore, QueuedOrder } from '@/store/offlineQueueStore';
import { drainQueue } from '@/lib/syncQueue';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Props {
  isDark:   boolean;
  onClose:  () => void;
}

export default function FailedQueueModal({ isDark, onClose }: Props) {
  const { items, clearFailed, markSyncing } = useOfflineQueueStore();
  const failed = items.filter((i) => i.status === 'failed');
  const [retrying, setRetrying] = useState(false);

  const bg    = isDark ? 'bg-[#0c0c0e] border-[#1e1e28]' : 'bg-white border-[#e8e3da]';
  const text  = isDark ? 'text-[#f2f2f5]'                 : 'text-[#1c1714]';
  const sub   = isDark ? 'text-[#4a4a58]'                  : 'text-[#a39083]';
  const card  = isDark ? 'bg-[#14141c] border-[#1e1e28]'   : 'bg-[#faf9f6] border-[#ece6dc]';

  const handleRetryAll = async () => {
    // Reset all failed back to pending
    const store = useOfflineQueueStore.getState();
    const toRetry = store.items.filter((i) => i.status === 'failed');
    toRetry.forEach((item) => {
      // Manually flip status back to pending via store update
      store.items = store.items.map((i) => i.id === item.id ? { ...i, status: 'pending' } : i) as QueuedOrder[];
    });
    // Trigger persist via clearFailed... no — we just update state then drain
    useOfflineQueueStore.setState((s) => ({
      items: s.items.map((i) => i.status === 'failed' ? { ...i, status: 'pending' as const, errorMessage: undefined } : i),
    }));

    setRetrying(true);
    try {
      const result = await drainQueue();
      if (result.created > 0) toast.success(`${result.created} order${result.created > 1 ? 's' : ''} synced`);
      if (result.failed > 0)  toast.error(`${result.failed} item${result.failed > 1 ? 's' : ''} still failing`);
    } finally {
      setRetrying(false);
    }
  };

  const handleClearFailed = async () => {
    await clearFailed();
    toast('Failed items cleared', { icon: '🗑️' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={clsx('w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden', bg)}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e28]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className={clsx('font-display font-bold text-base', text)}>Failed Orders</h2>
            <span className="text-xs font-bold px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full">{failed.length}</span>
          </div>
          <button onClick={onClose} className={clsx('p-1.5 rounded-lg transition-colors', isDark ? 'text-[#4a4a58] hover:text-[#9898a5] hover:bg-[#1e1e28]' : 'text-[#a39083] hover:bg-gray-100')}>
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto px-5 py-3 space-y-2">
          {failed.length === 0 ? (
            <div className={clsx('text-center py-8 text-sm', sub)}>No failed orders</div>
          ) : (
            failed.map((item) => (
              <div key={item.id} className={clsx('rounded-xl border p-3', card)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={clsx('font-semibold text-sm', text)}>
                      Rs. {item.total.toFixed(0)} · {item.paymentMethod}
                      <span className={clsx('ml-2 text-xs font-normal', sub)}>
                        {format(new Date(item.offlineCreatedAt), 'h:mm a')}
                      </span>
                    </p>
                    <p className={clsx('text-xs mt-0.5', sub)}>
                      {item.items.map((li) => `${li.quantity}× ${li.name}`).join(', ')}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                    Attempt {item.attempts}
                  </span>
                </div>
                {item.errorMessage && (
                  <p className="text-[11px] text-red-400 mt-1.5 bg-red-500/10 rounded-lg px-2 py-1">
                    {item.errorMessage}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-[#1e1e28]">
          <button
            onClick={handleClearFailed}
            className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
              isDark ? 'bg-[#1e1e28] text-[#9898a5] hover:text-red-400' : 'bg-gray-100 text-gray-600 hover:text-red-500')}
          >
            <Trash2 size={14} /> Clear All
          </button>
          <button
            onClick={handleRetryAll}
            disabled={retrying || failed.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {retrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {retrying ? 'Retrying…' : 'Retry All'}
          </button>
        </div>
      </div>
    </div>
  );
}
