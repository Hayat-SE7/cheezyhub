// ─────────────────────────────────────────────────────────
//  useDeliverySSE  — Phase 7
//  Identical to useSSE but reads ch_delivery_token
//  so the delivery panel is completely isolated.
//
//  Usage:
//    useDeliverySSE({
//      NEW_DELIVERY_ASSIGNED: (data) => { ... },
//      COD_SETTLED:           (data) => { ... },
//    });
// ─────────────────────────────────────────────────────────
'use client';

import { useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';
import { createEventDebouncer } from '@/lib/sseDebounce';
import { useDeliveryStore } from '@/store/deliveryStore';

type EventHandler = (data: unknown) => void;

export function useDeliverySSE(
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
    }, 150);
  }

  const connect = useCallback(async () => {
    const token = Cookies.get('ch_delivery_token');
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
          } catch { console.warn(`[DeliverySSE] bad parse on "${event}"`); }
        };
        listenersRef.current[event] = wrapper;
        es.addEventListener(event, wrapper);
      }
    };

    register();

    es.addEventListener('connected', () => {
      retryRef.current = 0;
      useDeliveryStore.getState().setSseConnected(true);
    });

    es.onerror = () => {
      useDeliveryStore.getState().setSseConnected(false);
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
