import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import Cookies from 'js-cookie';

// Mock sseDebounce — pass events through immediately
vi.mock('@/lib/sseDebounce', () => ({
  createEventDebouncer: (fn: any) => ({
    fire: fn,
    cancel: vi.fn(),
  }),
}));

// ── EventSource mock ─────────────────────────────────────
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: any) => void)[]> = {};
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (e: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  close() {
    this.closed = true;
  }

  // Test helper — emit an event
  emit(event: string, data: any, lastEventId?: string) {
    for (const h of this.listeners[event] ?? []) {
      h({ data: JSON.stringify(data), lastEventId: lastEventId ?? '' });
    }
  }

  emitConnected() {
    for (const h of this.listeners['connected'] ?? []) h({});
  }
}

vi.stubGlobal('EventSource', MockEventSource);

// ── Fetch mock for ticket endpoint ──────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { useSSE } from '@/hooks/useSSE';

describe('useSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.mocked(Cookies.get).mockReturnValue('test-token');
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { ticket: 'tkt-123' } }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not connect when no token is present', async () => {
    vi.mocked(Cookies.get).mockReturnValue(undefined);
    renderHook(() => useSSE({ onEvent: { ORDER: vi.fn() } }));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should fetch ticket and connect via EventSource', async () => {
    renderHook(() => useSSE({ onEvent: { ORDER: vi.fn() } }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sse/ticket'),
      expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer test-token' } }),
    );
    expect(MockEventSource.instances[0].url).toContain('ticket=tkt-123');
  });

  it('should fallback to token in URL when ticket fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    renderHook(() => useSSE({ onEvent: { ORDER: vi.fn() } }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    expect(MockEventSource.instances[0].url).toContain('token=test-token');
  });

  it('should register event listeners and invoke handlers on events', async () => {
    const handler = vi.fn();
    renderHook(() => useSSE({ onEvent: { NEW_ORDER: handler } }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const es = MockEventSource.instances[0];
    es.emit('NEW_ORDER', { id: 'ord-1' });
    expect(handler).toHaveBeenCalledWith('NEW_ORDER', { id: 'ord-1' });
  });

  it('should support shorthand pattern: useSSE({ EVENT: fn })', async () => {
    const handler = vi.fn();
    renderHook(() => useSSE({ MY_EVENT: handler }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const es = MockEventSource.instances[0];
    es.emit('MY_EVENT', { x: 1 });
    expect(handler).toHaveBeenCalledWith('MY_EVENT', { x: 1 });
  });

  it('should support legacy pattern: useSSE(url, handlers)', async () => {
    const handler = vi.fn();
    renderHook(() => useSSE('/sse/admin', { ADMIN_EVENT: handler }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const es = MockEventSource.instances[0];
    es.emit('ADMIN_EVENT', { y: 2 });
    expect(handler).toHaveBeenCalledWith('ADMIN_EVENT', { y: 2 });
  });

  it('should not connect when enabled=false', async () => {
    renderHook(() => useSSE({ onEvent: { ORDER: vi.fn() }, enabled: false }));
    await vi.waitFor(() => {});
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('should close EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useSSE({ onEvent: { ORDER: vi.fn() } }));
    await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  it('should reconnect with backoff on error', async () => {
    vi.useFakeTimers();
    renderHook(() => useSSE({ onEvent: { ORDER: vi.fn() } }));

    // Wait for initial connect
    await vi.runAllTimersAsync();
    expect(MockEventSource.instances).toHaveLength(1);

    const es = MockEventSource.instances[0];
    // Trigger error
    act(() => { es.onerror?.(); });

    // Advance past first reconnect delay (3000ms)
    await act(async () => { vi.advanceTimersByTime(3500); });
    // Should have created a new EventSource
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);

    vi.useRealTimers();
  });
});
