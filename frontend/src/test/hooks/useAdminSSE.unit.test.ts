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

import { useAdminSSE } from '@/hooks/useAdminSSE';

describe('useAdminSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.mocked(Cookies.get).mockReturnValue('admin-token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { ticket: 'adm-tkt' } }),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('should read ch_admin_token cookie', async () => {
    renderHook(() => useAdminSSE({ STATS_UPDATE: vi.fn() }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(Cookies.get).toHaveBeenCalledWith('ch_admin_token');
  });

  it('should not connect without admin token', async () => {
    vi.mocked(Cookies.get).mockReturnValue(undefined);
    renderHook(() => useAdminSSE({ STATS_UPDATE: vi.fn() }));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should invoke connected handler on connected event', async () => {
    const connectedHandler = vi.fn();
    renderHook(() => useAdminSSE({ connected: connectedHandler }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0].emitConnected();
    expect(connectedHandler).toHaveBeenCalled();
  });

  it('should dispatch events to handlers', async () => {
    const handler = vi.fn();
    renderHook(() => useAdminSSE({ NEW_ORDER: handler }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0].emit('NEW_ORDER', { id: '1' });
    expect(handler).toHaveBeenCalledWith('NEW_ORDER', { id: '1' });
  });

  it('should not connect when enabled=false', async () => {
    renderHook(() => useAdminSSE({ X: vi.fn() }, false));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should close on unmount', async () => {
    const { unmount } = renderHook(() => useAdminSSE({ X: vi.fn() }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    unmount();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });
});
