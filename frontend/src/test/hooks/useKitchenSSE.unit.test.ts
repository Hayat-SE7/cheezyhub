import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import Cookies from 'js-cookie';

// Mock stores
vi.mock('@/store/kitchenStore', () => ({
  useKitchenStore: { getState: vi.fn(() => ({ setSseConnected: vi.fn() })) },
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

import { useKitchenSSE } from '@/hooks/useKitchenSSE';
import { useKitchenStore } from '@/store/kitchenStore';

describe('useKitchenSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.mocked(Cookies.get).mockReturnValue('kitchen-token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { ticket: 'kt-tkt' } }),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('should read ch_kitchen_token cookie', async () => {
    renderHook(() => useKitchenSSE({ ORDER_UPDATE: vi.fn() }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(Cookies.get).toHaveBeenCalledWith('ch_kitchen_token');
  });

  it('should not connect if no kitchen token', async () => {
    vi.mocked(Cookies.get).mockReturnValue(undefined);
    renderHook(() => useKitchenSSE({ ORDER_UPDATE: vi.fn() }));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should call setSseConnected(true) on connected event', async () => {
    const mockSetSSE = vi.fn();
    vi.mocked(useKitchenStore.getState).mockReturnValue({ setSseConnected: mockSetSSE } as any);

    renderHook(() => useKitchenSSE({ ORDER_UPDATE: vi.fn() }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0].emitConnected();
    expect(mockSetSSE).toHaveBeenCalledWith(true);
  });

  it('should dispatch events to handlers', async () => {
    const handler = vi.fn();
    renderHook(() => useKitchenSSE({ ORDER_UPDATE: handler }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0].emit('ORDER_UPDATE', { orderId: '1' });
    expect(handler).toHaveBeenCalledWith('ORDER_UPDATE', { orderId: '1' });
  });

  it('should not connect when enabled=false', async () => {
    renderHook(() => useKitchenSSE({ ORDER_UPDATE: vi.fn() }, false));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should close EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useKitchenSSE({ X: vi.fn() }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    unmount();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });
});
