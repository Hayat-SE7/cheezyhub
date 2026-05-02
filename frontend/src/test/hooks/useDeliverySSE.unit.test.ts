import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import Cookies from 'js-cookie';

vi.mock('@/store/deliveryStore', () => ({
  useDeliveryStore: { getState: vi.fn(() => ({ setSseConnected: vi.fn() })) },
}));

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

import { useDeliverySSE } from '@/hooks/useDeliverySSE';
import { useDeliveryStore } from '@/store/deliveryStore';

describe('useDeliverySSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.mocked(Cookies.get).mockReturnValue('delivery-token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { ticket: 'dl-tkt' } }),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('should read ch_delivery_token cookie', async () => {
    renderHook(() => useDeliverySSE({ NEW_DELIVERY: vi.fn() }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(Cookies.get).toHaveBeenCalledWith('ch_delivery_token');
  });

  it('should not connect without token', async () => {
    vi.mocked(Cookies.get).mockReturnValue(undefined);
    renderHook(() => useDeliverySSE({ NEW_DELIVERY: vi.fn() }));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should set sseConnected on connected event', async () => {
    const mockSetSSE = vi.fn();
    vi.mocked(useDeliveryStore.getState).mockReturnValue({ setSseConnected: mockSetSSE } as any);

    renderHook(() => useDeliverySSE({ NEW_DELIVERY: vi.fn() }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0].emitConnected();
    expect(mockSetSSE).toHaveBeenCalledWith(true);
  });

  it('should dispatch events to handlers', async () => {
    const handler = vi.fn();
    renderHook(() => useDeliverySSE({ COD_SETTLED: handler }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0].emit('COD_SETTLED', { amount: 500 });
    expect(handler).toHaveBeenCalledWith('COD_SETTLED', { amount: 500 });
  });

  it('should set sseConnected(false) on error', async () => {
    vi.useFakeTimers();
    const mockSetSSE = vi.fn();
    vi.mocked(useDeliveryStore.getState).mockReturnValue({ setSseConnected: mockSetSSE } as any);

    renderHook(() => useDeliverySSE({ X: vi.fn() }));
    await vi.runAllTimersAsync();

    const es = MockEventSource.instances[0];
    es.onerror?.();
    expect(mockSetSSE).toHaveBeenCalledWith(false);

    vi.useRealTimers();
  });

  it('should close on unmount', async () => {
    const { unmount } = renderHook(() => useDeliverySSE({ X: vi.fn() }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    unmount();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });
});
