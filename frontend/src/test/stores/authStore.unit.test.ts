import { describe, it, expect, beforeEach, vi } from 'vitest';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/authStore';

vi.mocked(Cookies);

describe('[authStore]', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should set user, token, and isAuthenticated', () => {
      const user = { id: 'u1', name: 'John', role: 'customer' };
      useAuthStore.getState().login('test-token', user);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.token).toBe('test-token');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should set cookies', () => {
      const user = { id: 'u1', name: 'John', role: 'customer' };
      useAuthStore.getState().login('test-token', user, 'refresh-token');

      expect(Cookies.set).toHaveBeenCalledWith('ch_token', 'test-token', expect.any(Object));
      expect(Cookies.set).toHaveBeenCalledWith('ch_role', 'customer', expect.any(Object));
      expect(Cookies.set).toHaveBeenCalledWith('ch_refresh', 'refresh-token', expect.any(Object));
    });

    it('should not set refresh cookie if no refresh token', () => {
      const user = { id: 'u1', name: 'John', role: 'customer' };
      useAuthStore.getState().login('test-token', user);

      expect(Cookies.set).toHaveBeenCalledTimes(2); // token + role only
    });
  });

  describe('logout', () => {
    it('should clear user, token, and isAuthenticated', () => {
      useAuthStore.setState({ user: { id: 'u1', name: 'John', role: 'customer' }, token: 't', isAuthenticated: true });
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should remove all auth cookies', () => {
      useAuthStore.getState().logout();

      expect(Cookies.remove).toHaveBeenCalledWith('ch_token', { path: '/' });
      expect(Cookies.remove).toHaveBeenCalledWith('ch_refresh', { path: '/' });
      expect(Cookies.remove).toHaveBeenCalledWith('ch_role', { path: '/' });
    });
  });

  describe('setUser', () => {
    it('should update user without changing other state', () => {
      useAuthStore.setState({ token: 'existing', isAuthenticated: true, user: null });
      useAuthStore.getState().setUser({ id: 'u2', name: 'Jane', role: 'admin' });

      const state = useAuthStore.getState();
      expect(state.user?.name).toBe('Jane');
      expect(state.token).toBe('existing');
      expect(state.isAuthenticated).toBe(true);
    });
  });
});
