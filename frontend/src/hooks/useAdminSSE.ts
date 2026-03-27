// ─────────────────────────────────────────────────────────
//  useAdminSSE
//  Reads ch_admin_token
// ─────────────────────────────────────────────────────────
'use client';

import { useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';

type EventHandler = (data: unknown) => void;

export function useAdminSSE(
  handlers: Record<string, EventHandler>,
  enabled = true,
) {
  const esRef      = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const listenersRef = useRef<Record<string, (e: MessageEvent) => void>>({});

  const connect = useCallback(() => {
    const token = Cookies.get('ch_admin_token');
    if (!token || !enabled) return;

    esRef.current?.close();

    const url = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?token=${token}`;
    const es  = new EventSource(url);
    esRef.current = es;

    const register = () => {
      for (const event of Object.keys(handlersRef.current)) {
        if (listenersRef.current[event]) continue;
        const wrapper = (e: MessageEvent) => {
          try { handlersRef.current[event]?.(JSON.parse(e.data)); }
          catch { console.warn(`[AdminSSE] bad parse on "${event}"`); }
        };
        listenersRef.current[event] = wrapper;
        es.addEventListener(event, wrapper);
      }
    };

    register();
    setTimeout(register, 0);

    es.addEventListener('connected', () => {
      console.log('[AdminSSE] ✅ Connected');
      handlersRef.current['connected']?.({});
    });

    es.onerror = () => {
      es.close();
      listenersRef.current = {};
      setTimeout(connect, 3000);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      listenersRef.current = {};
    };
  }, [connect]);
}
