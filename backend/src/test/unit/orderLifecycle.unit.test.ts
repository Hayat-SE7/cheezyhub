import { describe, it, expect } from 'vitest';
import { validateTransition, getAllowedTransitions } from '../../services/orderLifecycle';

describe('[orderLifecycle] - validateTransition', () => {
  // ── Valid transitions ──────────────────────────────
  const validTransitions = [
    { from: 'pending', to: 'preparing', role: 'kitchen' },
    { from: 'pending', to: 'preparing', role: 'admin' },
    { from: 'pending', to: 'cancelled', role: 'kitchen' },
    { from: 'pending', to: 'cancelled', role: 'admin' },
    { from: 'preparing', to: 'ready', role: 'kitchen' },
    { from: 'preparing', to: 'ready', role: 'admin' },
    { from: 'preparing', to: 'cancelled', role: 'kitchen' },
    { from: 'preparing', to: 'cancelled', role: 'admin' },
    { from: 'ready', to: 'assigned', role: 'admin' },
    { from: 'ready', to: 'assigned', role: 'system' },
    { from: 'ready', to: 'completed', role: 'system' },
    { from: 'ready', to: 'completed', role: 'admin' },
    { from: 'assigned', to: 'picked_up', role: 'delivery' },
    { from: 'assigned', to: 'picked_up', role: 'admin' },
    { from: 'picked_up', to: 'delivered', role: 'delivery' },
    { from: 'picked_up', to: 'delivered', role: 'admin' },
    { from: 'delivered', to: 'completed', role: 'system' },
  ];

  validTransitions.forEach(({ from, to, role }) => {
    it(`should allow ${from} → ${to} for role '${role}'`, () => {
      expect(() => validateTransition(from as any, to as any, role)).not.toThrow();
    });
  });

  // ── Invalid transitions ────────────────────────────
  it('should reject pending → delivered (skips states)', () => {
    expect(() => validateTransition('pending' as any, 'delivered' as any, 'admin')).toThrow(
      'Invalid transition'
    );
  });

  it('should reject completed → pending (backwards)', () => {
    expect(() => validateTransition('completed' as any, 'pending' as any, 'admin')).toThrow(
      'Invalid transition'
    );
  });

  it('should reject cancelled → preparing (revive)', () => {
    expect(() => validateTransition('cancelled' as any, 'preparing' as any, 'admin')).toThrow(
      'Invalid transition'
    );
  });

  it('should reject ready → preparing (backwards)', () => {
    expect(() => validateTransition('ready' as any, 'preparing' as any, 'kitchen')).toThrow(
      'Invalid transition'
    );
  });

  // ── Role violations ────────────────────────────────
  it('should reject customer role for any transition', () => {
    expect(() => validateTransition('pending' as any, 'preparing' as any, 'customer')).toThrow(
      "Role 'customer'"
    );
  });

  it('should reject kitchen trying to assign (ready → assigned)', () => {
    expect(() => validateTransition('ready' as any, 'assigned' as any, 'kitchen')).toThrow(
      "Role 'kitchen'"
    );
  });

  it('should reject delivery trying to prepare (pending → preparing)', () => {
    expect(() => validateTransition('pending' as any, 'preparing' as any, 'delivery')).toThrow(
      "Role 'delivery'"
    );
  });

  it('should reject non-system role for delivered → completed', () => {
    expect(() => validateTransition('delivered' as any, 'completed' as any, 'admin')).toThrow(
      "Role 'admin'"
    );
  });
});

describe('[orderLifecycle] - getAllowedTransitions', () => {
  it('should return [preparing, cancelled] for kitchen at pending', () => {
    const allowed = getAllowedTransitions('pending' as any, 'kitchen');
    expect(allowed).toEqual(expect.arrayContaining(['preparing', 'cancelled']));
    expect(allowed).toHaveLength(2);
  });

  it('should return [ready, cancelled] for kitchen at preparing', () => {
    const allowed = getAllowedTransitions('preparing' as any, 'kitchen');
    expect(allowed).toEqual(expect.arrayContaining(['ready', 'cancelled']));
    expect(allowed).toHaveLength(2);
  });

  it('should return [picked_up] for delivery at assigned', () => {
    const allowed = getAllowedTransitions('assigned' as any, 'delivery');
    expect(allowed).toEqual(['picked_up']);
  });

  it('should return [delivered] for delivery at picked_up', () => {
    const allowed = getAllowedTransitions('picked_up' as any, 'delivery');
    expect(allowed).toEqual(['delivered']);
  });

  it('should return empty array for customer at any status', () => {
    expect(getAllowedTransitions('pending' as any, 'customer')).toEqual([]);
    expect(getAllowedTransitions('preparing' as any, 'customer')).toEqual([]);
  });

  it('should return empty array for completed status (terminal)', () => {
    expect(getAllowedTransitions('completed' as any, 'admin')).toEqual([]);
    expect(getAllowedTransitions('completed' as any, 'system')).toEqual([]);
  });

  it('should return empty array for cancelled status (terminal)', () => {
    expect(getAllowedTransitions('cancelled' as any, 'admin')).toEqual([]);
  });

  it('should return [assigned, completed] for admin at ready', () => {
    const allowed = getAllowedTransitions('ready' as any, 'admin');
    expect(allowed).toEqual(expect.arrayContaining(['assigned', 'completed']));
    expect(allowed).toHaveLength(2);
  });
});
