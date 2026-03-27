// ─────────────────────────────────────────────────────────────────
//  offlineQueueStore — CheezyHub POS
//  Generic action queue backed by IndexedDB (idb-keyval).
//  Queue cap: 50 non-failed items.
//  id is always auto-generated — callers never pass it.
// ─────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { get, set, del } from 'idb-keyval';

const IDB_KEY   = 'ch_offline_queue';
const QUEUE_CAP = 50;

export type QueueItemStatus = 'pending' | 'syncing' | 'failed';
export type QueueItemType   = 'order' | 'payment' | 'shift_start' | 'shift_end';

export interface QueuedOrder {
  id:           string;          // auto-generated UUID = idempotency key
  type:         QueueItemType;
  endpoint:     string;          // e.g. '/counter/orders'
  method:       'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload:      unknown;         // full request body forwarded as-is
  localLabel:   string;          // human-readable label for UI
  createdAt:    string;          // ISO timestamp
  status:       QueueItemStatus;
  errorMessage?: string;
  attempts:     number;

  // Added for counter POS orders
  total?:            number;
  paymentMethod?:    string;
  offlineCreatedAt?: string;
  items?:            any[];
  idempotencyKey?:   string;
  customerNote?:     string;
}

// What callers pass to enqueue() — no status, no attempts, no createdAt
export type EnqueuePayload = Pick<QueuedOrder, 'type' | 'endpoint' | 'method' | 'payload' | 'localLabel' | 'total' | 'paymentMethod' | 'offlineCreatedAt' | 'items' | 'idempotencyKey' | 'customerNote'> & { id?: string };

interface OfflineQueueState {
  items:    QueuedOrder[];
  hydrated: boolean;

  hydrate:     ()                            => Promise<void>;
  enqueue:     (item: EnqueuePayload)        => Promise<string | null>; // returns id or null if full
  markSyncing: (id: string)                  => void;
  markSynced:  (id: string)                  => Promise<void>;
  markFailed:  (id: string, err: string)     => Promise<void>;
  clearFailed: ()                            => Promise<void>;
  clearAll:    ()                            => Promise<void>;
  pendingCount:()                            => number;
  failedCount: ()                            => number;
  isFull:      ()                            => boolean;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function persist(items: QueuedOrder[]) {
  try { await set(IDB_KEY, JSON.stringify(items)); } catch { /* silent fail */ }
}

export const useOfflineQueueStore = create<OfflineQueueState>((setState, getState) => ({
  items:    [],
  hydrated: false,

  hydrate: async () => {
    if (getState().hydrated) return;
    try {
      const raw    = await get(IDB_KEY);
      const items: QueuedOrder[] = raw ? JSON.parse(raw as string) : [];
      // Reset any 'syncing' items back to pending on reload
      const cleaned = items.map((i) =>
        i.status === 'syncing' ? { ...i, status: 'pending' as const } : i
      );
      setState({ items: cleaned, hydrated: true });
    } catch {
      setState({ hydrated: true });
    }
  },

  enqueue: async (item) => {
    const current = getState().items;
    const active  = current.filter((i) => i.status !== 'failed').length;
    if (active >= QUEUE_CAP) return null;

    const entry: QueuedOrder = {
      ...item,
      id:       item.id ?? uuid(),
      createdAt: new Date().toISOString(),
      status:   'pending',
      attempts: 0,
    };
    const next = [...current, entry];
    setState({ items: next });
    await persist(next);
    return entry.id;
  },

  markSyncing: (id) =>
    setState((s) => ({
      items: s.items.map((i) => i.id === id ? { ...i, status: 'syncing' as const } : i),
    })),

  markSynced: async (id) => {
    const next = getState().items.filter((i) => i.id !== id);
    setState({ items: next });
    await persist(next);
  },

  markFailed: async (id, err) => {
    const next = getState().items.map((i) =>
      i.id === id
        ? { ...i, status: 'failed' as const, errorMessage: err, attempts: i.attempts + 1 }
        : i
    );
    setState({ items: next });
    await persist(next);
  },

  clearFailed: async () => {
    const next = getState().items.filter((i) => i.status !== 'failed');
    setState({ items: next });
    await persist(next);
  },

  clearAll: async () => {
    setState({ items: [] });
    await del(IDB_KEY);
  },

  pendingCount: () => getState().items.filter((i) => i.status === 'pending').length,
  failedCount:  () => getState().items.filter((i) => i.status === 'failed').length,
  isFull:       () => getState().items.filter((i) => i.status !== 'failed').length >= QUEUE_CAP,
}));
