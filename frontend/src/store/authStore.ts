import { create }  from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies     from 'js-cookie';

export interface AuthUser {
  id:       string;
  name?:    string;
  username?: string;
  mobile?:  string;
  email?:   string;
  role:     string;
}

interface AuthState {
  user:            AuthUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  login:   (token: string, user: AuthUser, refreshToken?: string) => void;
  logout:  () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,

      login: (token, user, refreshToken) => {
        Cookies.set('ch_token', token, { expires: 1, sameSite: 'lax', path: '/', secure: window.location.protocol === 'https:' });
        Cookies.set('ch_role', user.role, { expires: 7, sameSite: 'lax', path: '/', secure: window.location.protocol === 'https:' });
        if (refreshToken) Cookies.set('ch_refresh', refreshToken, { expires: 7, sameSite: 'lax', path: '/', secure: window.location.protocol === 'https:' });
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        ['ch_token', 'ch_refresh', 'ch_role'].forEach(c => {
          Cookies.remove(c, { path: '/' });
        });
        set({ token: null, user: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name:       'cheezyhub-auth',
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    }
  )
);
