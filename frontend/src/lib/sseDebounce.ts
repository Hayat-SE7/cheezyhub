// Per-event trailing-edge debouncer. Coalesces bursts of the same event name
// into one invocation ~150ms after the last event of that name.
// The latest payload wins; earlier payloads in the same burst are dropped.
export function createEventDebouncer<T = unknown>(
  fn: (eventName: string, data: T) => void,
  ms = 150,
) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const latest = new Map<string, T>();

  const fire = (eventName: string, data: T) => {
    latest.set(eventName, data);
    const prev = timers.get(eventName);
    if (prev) clearTimeout(prev);
    timers.set(
      eventName,
      setTimeout(() => {
        const payload = latest.get(eventName) as T;
        timers.delete(eventName);
        latest.delete(eventName);
        fn(eventName, payload);
      }, ms),
    );
  };

  const cancel = () => {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    latest.clear();
  };

  return { fire, cancel };
}
