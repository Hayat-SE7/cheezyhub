'use client';

// ─────────────────────────────────────────────────────────────────
//  useCounterSSE — Phase 12
//  Connects the counter panel to the SSE stream using ch_counter_token.
//  Listens for:
//    • menu_cache_invalidate  — admin updated menu; purge SW cache
//    • order_status           — order updates (future use)
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';
import { createEventDebouncer } from '@/lib/sseDebounce';

type EventHandler = (data: unknown) => void;

interface UseCounterSSEOptions {
  onMenuInvalidate?: () => void;
  onEvent?:          Record<string, EventHandler>;
  enabled?:          boolean;
}

export function useCounterSSE({
  onMenuInvalidate,
  onEvent = {},
  enabled = true,
}: UseCounterSSEOptions = {}) {
  const esRef         = useRef<EventSource | null>(null);
  const handlersRef   = useRef<Record<string, EventHandler>>({});
  const wrappersRef   = useRef<Record<string, (e: MessageEvent) => void>>({});
  const retryRef      = useRef(0);
  const lastEventIdRef = useRef<string | null>(null);
  const debouncerRef  = useRef<ReturnType<typeof createEventDebouncer> | null>(null);
  if (!debouncerRef.current) {
    debouncerRef.current = createEventDebouncer((event, data) => {
      handlersRef.current[event]?.(data);
    }, 150);
  }

  handlersRef.current = {
    ...onEvent,
    menu_cache_invalidate: () => {
      // Tell the service worker to delete the menu cache
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'INVALIDATE_MENU_CACHE' });
      }
      // Also dispatch a DOM event so layout.tsx can handle cache warming
      window.dispatchEvent(new CustomEvent('ch:menu-invalidate'));
      onMenuInvalidate?.();
    },
  };

  const connect = useCallback(async () => {
    const token = Cookies.get('ch_counter_token');
    if (!token || !enabled) return;

    esRef.current?.close();

    let url: string;
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sse/ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await resp.json();
      if (json.success && json.data?.ticket) {
        url = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?ticket=${json.data.ticket}`;
      } else {
        url = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?token=${token}`;
      }
    } catch {
      url = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?token=${token}`;
    }
    if (lastEventIdRef.current) url += `&lastEventId=${lastEventIdRef.current}`;

    const es  = new EventSource(url);
    esRef.current = es;

    const registerHandlers = () => {
      for (const eventName of Object.keys(handlersRef.current)) {
        if (wrappersRef.current[eventName]) continue;
        const wrapper = (e: MessageEvent) => {
          try {
            if (e.lastEventId) lastEventIdRef.current = e.lastEventId;
            const data = JSON.parse(e.data);
            debouncerRef.current!.fire(eventName, data);
          } catch {
            console.warn(`[CounterSSE] Failed to parse event "${eventName}"`);
          }
        };
        wrappersRef.current[eventName] = wrapper;
        es.addEventListener(eventName, wrapper);
      }
    };

    es.addEventListener('connected', () => { console.log('[CounterSSE] ✅ Connected'); retryRef.current = 0; });
    registerHandlers();

    es.onerror = () => {
      const delay = Math.min(3000 * Math.pow(2, retryRef.current), 60000);
      console.warn(`[CounterSSE] ⚠ Disconnected — reconnecting in ${delay / 1000}s...`);
      es.close();
      wrappersRef.current = {};
      retryRef.current++;
      setTimeout(connect, delay);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      wrappersRef.current = {};
      debouncerRef.current?.cancel();
    };
  }, [connect]);
}
