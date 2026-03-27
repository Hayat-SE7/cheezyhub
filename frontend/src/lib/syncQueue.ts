// ─────────────────────────────────────────────────────────────────
//  syncQueue — CheezyHub POS
//  Drains the offline queue by replaying each action against its
//  stored endpoint.
//
//  Error strategy:
//    4xx        → mark failed, do NOT retry
//    5xx / net  → mark failed, will retry next sync
//    401        → stop entire drain
// ─────────────────────────────────────────────────────────────────

import Cookies from 'js-cookie';
import { useOfflineQueueStore } from '@/store/offlineQueueStore';

const BATCH_SIZE = 10;
const BASE       = process.env.NEXT_PUBLIC_API_URL ?? '';

// ─── Sound cues ───────────────────────────────────────────────────
export function playBeep(type: 'offline' | 'reconnect' | 'success') {
  if (typeof AudioContext === 'undefined') return;
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'offline') {
      osc.frequency.value = 220; gain.gain.value = 0.3; osc.type = 'sawtooth';
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'reconnect') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.value = 0.25; osc.type = 'sine';
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else {
      [0, 0.1, 0.2].forEach((delay) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.2; o.type = 'sine';
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 0.08);
      });
    }
  } catch { /* silent fail */ }
}

// ─── Main drain function ──────────────────────────────────────────
export async function drainQueue(
  onProgress?: (done: number, total: number) => void
): Promise<{ created: number; failed: number; stopped: boolean }> {
  const store   = useOfflineQueueStore.getState();
  const pending = store.items.filter((i) => i.status === 'pending');

  if (!pending.length) return { created: 0, failed: 0, stopped: false };

  const token = Cookies.get('ch_counter_token');
  if (!token) return { created: 0, failed: 0, stopped: true };

  let created = 0, failed = 0, stopped = false;
  let done = 0;
  const total = pending.length;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    batch.forEach((item) => useOfflineQueueStore.getState().markSyncing(item.id));

    // Build batch payload — item.id is the idempotency key
    const syncPayload = batch.map((item) => ({
      idempotencyKey: item.id,
      createdAt:      item.createdAt,
      type:           item.type,
      endpoint:       item.endpoint,
      method:         item.method,
      body:           item.payload,   // forwarded verbatim to backend
    }));

    let res: Response;
    try {
      res = await fetch(`${BASE}/counter/sync`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ items: syncPayload }),
        signal:  AbortSignal.timeout(30_000),
      });
    } catch {
      for (const item of batch) {
        await useOfflineQueueStore.getState().markFailed(item.id, 'Network error');
        failed++;
      }
      done += batch.length;
      onProgress?.(done, total);
      continue;
    }

    if (res.status === 401) {
      for (const item of batch) {
        await useOfflineQueueStore.getState().markFailed(item.id, 'Auth expired');
      }
      stopped = true;
      break;
    }

    if (!res.ok) {
      for (const item of batch) {
        await useOfflineQueueStore.getState().markFailed(item.id, `Server error ${res.status}`);
        failed++;
      }
      done += batch.length;
      onProgress?.(done, total);
      continue;
    }

    const json = await res.json() as {
      success: boolean;
      data: { results: { idempotencyKey: string; status: string; error?: string }[] };
    };

    for (const result of json.data.results) {
      const item = batch.find((b) => b.id === result.idempotencyKey);
      if (!item) continue;

      if (['created', 'duplicate', 'ok'].includes(result.status)) {
        await useOfflineQueueStore.getState().markSynced(item.id);
        created++;
      } else {
        await useOfflineQueueStore.getState().markFailed(item.id, result.error ?? 'Rejected');
        failed++;
      }
    }

    done += batch.length;
    onProgress?.(done, total);
  }

  if (!stopped) {
    if (failed > 0 && created === 0) playBeep('offline');
    else if (created > 0) playBeep('success');
  }

  return { created, failed, stopped };
}
