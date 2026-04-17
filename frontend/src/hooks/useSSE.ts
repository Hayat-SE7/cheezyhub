'use client';

import { useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';
import { createEventDebouncer } from '@/lib/sseDebounce';

type EventHandler = (data: unknown) => void;

interface UseSSEOptions {
  onEvent?: Record<string, EventHandler>;
  enabled?: boolean;
  [key: string]: EventHandler | Record<string, EventHandler> | boolean | undefined;
}

// Supports all three call signatures used across the codebase:
//   1. useSSE({ onEvent: { EVENT: fn }, enabled? })  ← structured style
//   2. useSSE({ EVENT: fn, EVENT2: fn2 })             ← shorthand (handlers as top-level keys)
//   3. useSSE('/sse/admin', { EVENT: fn })            ← legacy url + handlers style
export function useSSE(
  urlOrOptions?: string | UseSSEOptions,
  legacyHandlers?: Record<string, EventHandler>,
) {
  let onEvent: Record<string, EventHandler> = {};
  let enabled = true;

  if (typeof urlOrOptions === 'string') {
    // Pattern 3: useSSE(url, handlers)
    onEvent = legacyHandlers ?? {};
  } else if (urlOrOptions) {
    if (urlOrOptions.onEvent || 'enabled' in urlOrOptions) {
      // Pattern 1: useSSE({ onEvent, enabled })
      onEvent = (urlOrOptions.onEvent as Record<string, EventHandler>) ?? {};
      enabled = urlOrOptions.enabled !== false;
      // Also pick up any stray top-level handler keys alongside onEvent/enabled
      for (const [k, v] of Object.entries(urlOrOptions)) {
        if (k !== 'onEvent' && k !== 'enabled' && typeof v === 'function') {
          onEvent[k] = v as EventHandler;
        }
      }
    } else {
      // Pattern 2: useSSE({ EVENT: fn }) — all keys are handlers
      for (const [k, v] of Object.entries(urlOrOptions)) {
        if (typeof v === 'function') onEvent[k] = v as EventHandler;
      }
    }
  }

  const esRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Record<string, EventHandler>>({});
  handlersRef.current = onEvent;

  const listenerWrappersRef = useRef<Record<string, (e: MessageEvent) => void>>({});
  const retryRef = useRef(0);
  const debouncerRef = useRef<ReturnType<typeof createEventDebouncer> | null>(null);
  if (!debouncerRef.current) {
    debouncerRef.current = createEventDebouncer((event, data) => {
      handlersRef.current[event]?.(data);
    }, 150);
  }

  const connect = useCallback(() => {
    const token = Cookies.get('ch_token');
    if (!token || !enabled) return;

    esRef.current?.close();

    const url = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?token=${token}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('connected', () => {
      console.log('[SSE] ✅ Connected');
      retryRef.current = 0;
    });

    const registerHandlers = () => {
      for (const eventName of Object.keys(handlersRef.current)) {
        if (listenerWrappersRef.current[eventName]) continue;
        const wrapper = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            debouncerRef.current!.fire(eventName, data);
          } catch {
            console.warn(`[SSE] Failed to parse event "${eventName}"`);
          }
        };
        listenerWrappersRef.current[eventName] = wrapper;
        es.addEventListener(eventName, wrapper);
      }
    };

    registerHandlers();

    es.onerror = () => {
      const delay = Math.min(3000 * Math.pow(2, retryRef.current), 60000);
      console.warn(`[SSE] ⚠ Disconnected — reconnecting in ${delay / 1000}s...`);
      es.close();
      listenerWrappersRef.current = {};
      retryRef.current++;
      setTimeout(connect, delay);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      listenerWrappersRef.current = {};
      debouncerRef.current?.cancel();
    };
  }, [connect]);
}