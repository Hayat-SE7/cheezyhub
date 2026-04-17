'use client';

import { useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';
import { createEventDebouncer } from '@/lib/sseDebounce';
import { useKitchenStore } from '@/store/kitchenStore';

type EventHandler = (data: unknown) => void;

export function useKitchenSSE(handlers: Record<string, EventHandler>, enabled = true) {
  const esRef        = useRef<EventSource | null>(null);
  const handlersRef  = useRef(handlers);
  handlersRef.current = handlers;
  const listenersRef = useRef<Record<string, (e: MessageEvent) => void>>({});
  const retryRef     = useRef(0);
  const debouncerRef = useRef<ReturnType<typeof createEventDebouncer> | null>(null);
  if (!debouncerRef.current) {
    debouncerRef.current = createEventDebouncer((event, data) => {
      handlersRef.current[event]?.(data);
    }, 150);
  }

  const connect = useCallback(() => {
    const token = Cookies.get('ch_kitchen_token');
    if (!token || !enabled) return;
    esRef.current?.close();
    const es = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/sse/connect?token=${token}`);
    esRef.current = es;

    const register = () => {
      for (const event of Object.keys(handlersRef.current)) {
        if (listenersRef.current[event]) continue;
        const wrapper = (e: MessageEvent) => {
          try { debouncerRef.current!.fire(event, JSON.parse(e.data)); }
          catch { console.warn(`[KitchenSSE] bad parse on "${event}"`); }
        };
        listenersRef.current[event] = wrapper;
        es.addEventListener(event, wrapper);
      }
    };

    register();
    es.addEventListener('connected', () => {
      console.log('[KitchenSSE] ✅ Connected');
      retryRef.current = 0;
      useKitchenStore.getState().setSseConnected(true);
    });
    es.onerror = () => {
      useKitchenStore.getState().setSseConnected(false);
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
