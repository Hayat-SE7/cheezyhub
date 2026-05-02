import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEventDebouncer } from '@/lib/sseDebounce';

describe('[sseDebounce] - createEventDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call handler after debounce period', () => {
    const handler = vi.fn();
    const { fire } = createEventDebouncer(handler, 150);

    fire('ORDER_UPDATED', { orderId: '1' });
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(handler).toHaveBeenCalledWith('ORDER_UPDATED', { orderId: '1' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should coalesce rapid events into one call with latest payload', () => {
    const handler = vi.fn();
    const { fire } = createEventDebouncer(handler, 150);

    fire('ORDER_UPDATED', { status: 'pending' });
    fire('ORDER_UPDATED', { status: 'preparing' });
    fire('ORDER_UPDATED', { status: 'ready' });

    vi.advanceTimersByTime(150);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('ORDER_UPDATED', { status: 'ready' });
  });

  it('should debounce different event names independently', () => {
    const handler = vi.fn();
    const { fire } = createEventDebouncer(handler, 150);

    fire('ORDER_UPDATED', { id: '1' });
    fire('MENU_CHANGED', { id: '2' });

    vi.advanceTimersByTime(150);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith('ORDER_UPDATED', { id: '1' });
    expect(handler).toHaveBeenCalledWith('MENU_CHANGED', { id: '2' });
  });

  it('should use default 150ms when no ms provided', () => {
    const handler = vi.fn();
    const { fire } = createEventDebouncer(handler);

    fire('TEST', {});
    vi.advanceTimersByTime(149);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support custom debounce interval', () => {
    const handler = vi.fn();
    const { fire } = createEventDebouncer(handler, 300);

    fire('TEST', {});
    vi.advanceTimersByTime(299);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should cancel all pending events', () => {
    const handler = vi.fn();
    const { fire, cancel } = createEventDebouncer(handler, 150);

    fire('A', {});
    fire('B', {});
    cancel();

    vi.advanceTimersByTime(200);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should reset timer on each fire call', () => {
    const handler = vi.fn();
    const { fire } = createEventDebouncer(handler, 150);

    fire('X', { n: 1 });
    vi.advanceTimersByTime(100); // 100ms in
    fire('X', { n: 2 }); // resets timer
    vi.advanceTimersByTime(100); // 200ms total, but only 100ms since last fire
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50); // 150ms since last fire
    expect(handler).toHaveBeenCalledWith('X', { n: 2 });
  });
});
