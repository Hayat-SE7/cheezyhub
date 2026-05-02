// ─────────────────────────────────────────────────────────
//  useAdminSSE
//  Reads ch_admin_token
// ─────────────────────────────────────────────────────────
'use client';

import { useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';
import { createEventDebouncer } from '@/lib/sseDebounce';

type EventHandler = (data: unknown) => void;

export function useAdminSSE(
  handlers: Record<string, EventHandler>,
  enabled = true,
) {
  const esRef      = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const listenersRef = useRef<Record<string, (e: MessageEvent) => void>>({});
  const retryRef     = useRef(0);
  const lastEventIdRef = useRef<string | null>(null);
  const debouncerRef = useRef<ReturnType<typeof createEventDebouncer> | null>(null);
  if (!debouncerRef.current) {
    debouncerRef.current = createEventDebouncer((event, data) => {
      handlersRef.current[event]?.(data);
    }, 300);
  }

  const connect = useCallback(async () => {
    const token = Cookies.get('ch_admin_token');
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

    const register = () => {
      for (const event of Object.keys(handlersRef.current)) {
        if (listenersRef.current[event]) continue;
        const wrapper = (e: MessageEvent) => {
          try {
            if (e.lastEventId) lastEventIdRef.current = e.lastEventId;
            debouncerRef.current!.fire(event, JSON.parse(e.data));
          } catch { console.warn(`[AdminSSE] bad parse on "${event}"`); }
        };
        listenersRef.current[event] = wrapper;
        es.addEventListener(event, wrapper);
      }
    };

    register();

    es.addEventListener('connected', () => {
      console.log('[AdminSSE] ✅ Connected');
      retryRef.current = 0;
      handlersRef.current['connected']?.({});
    });

    es.onerror = () => {
      const delay = Math.min(3000 * Math.pow(2, retryRef.current), 60000);
      es.close();
      listenersRef.current = {};
      retryRef.current++;
      setTimeout(connect, delay);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      listenersRef.current = {};
      debouncerRef.current?.cancel();
    };
  }, [connect]);
}
