import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import Cookies from 'js-cookie';

vi.mock('@/lib/sseDebounce', () => ({
  createEventDebouncer: (fn: any) => ({ fire: fn, cancel: vi.fn() }),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: any) => void)[]> = {};
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string) { this.url = url; MockEventSource.instances.push(this); }
  addEventListener(event: string, handler: (e: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }
  close() { this.closed = true; }
  emit(event: string, data: any) {
    for (const h of this.listeners[event] ?? []) h({ data: JSON.stringify(data), lastEventId: '' });
  }
  emitConnected() { for (const h of this.listeners['connected'] ?? []) h({}); }
}

vi.stubGlobal('EventSource', MockEventSource);
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { useCounterSSE } from '@/hooks/useCounterSSE';

describe('useCounterSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.mocked(Cookies.get).mockReturnValue('counter-token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { ticket: 'ctr-tkt' } }),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('should read ch_counter_token cookie', async () => {
    renderHook(() => useCounterSSE({ onEvent: { ORDER: vi.fn() } }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(Cookies.get).toHaveBeenCalledWith('ch_counter_token');
  });

  it('should not connect without token', async () => {
    vi.mocked(Cookies.get).mockReturnValue(undefined);
    renderHook(() => useCounterSSE({ onEvent: { ORDER: vi.fn() } }));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should handle onMenuInvalidate via menu_cache_invalidate event', async () => {
    const onMenuInvalidate = vi.fn();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    renderHook(() => useCounterSSE({ onMenuInvalidate }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    // The hook registers menu_cache_invalidate internally
    MockEventSource.instances[0].emit('menu_cache_invalidate', {});
    expect(onMenuInvalidate).toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));

    dispatchSpy.mockRestore();
  });

  it('should dispatch custom onEvent handlers', async () => {
    const handler = vi.fn();
    renderHook(() => useCounterSSE({ onEvent: { ORDER_STATUS: handler } }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0].emit('ORDER_STATUS', { status: 'ready' });
    expect(handler).toHaveBeenCalledWith('ORDER_STATUS', { status: 'ready' });
  });

  it('should not connect when enabled=false', async () => {
    renderHook(() => useCounterSSE({ enabled: false }));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should close on unmount', async () => {
    const { unmount } = renderHook(() => useCounterSSE({ onEvent: { X: vi.fn() } }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    unmount();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });
});
