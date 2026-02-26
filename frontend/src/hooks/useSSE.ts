'use client';

import { useEffect, useRef, useCallback } from 'react';
import Cookies from 'js-cookie';

type EventHandler = (data: unknown) => void;

interface UseSSEOptions {
  onEvent?: Record<string, EventHandler>;
  enabled?: boolean;
}

export function useSSE({ onEvent = {}, enabled = true }: UseSSEOptions = {}) {
  const esRef = useRef<EventSource | null>(null);
  // Always hold latest handlers — avoids stale closures without re-connecting
  const handlersRef = useRef<Record<string, EventHandler>>({});
  handlersRef.current = onEvent;

  // Registered listener wrappers — so we can remove them on cleanup
  const listenerWrappersRef = useRef<Record<string, (e: MessageEvent) => void>>({});

  const connect = useCallback(() => {
    const token = Cookies.get('ch_token');
    if (!token || !enabled) return;

    // Close any existing connection
    esRef.current?.close();

    const url = `${process.env.NEXT_PUBLIC_API_URL}/sse/connect?token=${token}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('connected', () => {
      console.log('[SSE] ✅ Connected');
    });

    // Register all event listeners from the current handlers map
    const registerHandlers = () => {
      const eventNames = Object.keys(handlersRef.current);
      for (const eventName of eventNames) {
        // Avoid duplicate listeners
        if (listenerWrappersRef.current[eventName]) continue;

        const wrapper = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlersRef.current[eventName]?.(data);
          } catch {
            console.warn(`[SSE] Failed to parse event "${eventName}"`);
          }
        };
        listenerWrappersRef.current[eventName] = wrapper;
        es.addEventListener(eventName, wrapper);
      }
    };

    // Register immediately + after a tick (handles delayed handler registration)
    registerHandlers();
    setTimeout(registerHandlers, 0);

    es.onerror = () => {
      console.warn('[SSE] ⚠ Disconnected — reconnecting in 3s...');
      es.close();
      listenerWrappersRef.current = {};
      setTimeout(connect, 3000);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      listenerWrappersRef.current = {};
    };
  }, [connect]);
}

