import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

interface AuthUser {
  id: string;
  name?: string;
  username?: string;
  mobile?: string;
  email?: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (token, user) => {
        Cookies.set('ch_token', token, { expires: 7, sameSite: 'strict' });
        Cookies.set('ch_role', user.role, { expires: 7, sameSite: 'strict' });
        localStorage.setItem('ch_role', user.role);
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        Cookies.remove('ch_token');
        Cookies.remove('ch_role');
        localStorage.removeItem('ch_role');
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'cheezyhub-auth',
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    }
  )
);
