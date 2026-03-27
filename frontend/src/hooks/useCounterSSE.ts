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

  const connect = useCallback(() => {
    const token = Cookies.get('ch_counter_token');
    if (!token || !enabled) return;

    esRef.current?.close();

    const url = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?token=${token}`;
    const es  = new EventSource(url);
    esRef.current = es;

    const registerHandlers = () => {
      for (const eventName of Object.keys(handlersRef.current)) {
        if (wrappersRef.current[eventName]) continue;
        const wrapper = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlersRef.current[eventName]?.(data);
          } catch {
            console.warn(`[CounterSSE] Failed to parse event "${eventName}"`);
          }
        };
        wrappersRef.current[eventName] = wrapper;
        es.addEventListener(eventName, wrapper);
      }
    };

    es.addEventListener('connected', () => console.log('[CounterSSE] ✅ Connected'));
    registerHandlers();
    setTimeout(registerHandlers, 0);

    es.onerror = () => {
      console.warn('[CounterSSE] ⚠ Disconnected — reconnecting in 3s...');
      es.close();
      wrappersRef.current = {};
      setTimeout(connect, 3000);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      wrappersRef.current = {};
    };
  }, [connect]);
}
