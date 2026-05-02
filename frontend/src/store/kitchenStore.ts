import { create }  from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies     from 'js-cookie';

export interface KitchenUser {
  id: string; username: string; role: string; fullName?: string;
}

interface KitchenState {
  user: KitchenUser | null; token: string | null; isAuthenticated: boolean;
  sseConnected: boolean;
  login:  (token: string, user: KitchenUser, refreshToken?: string) => void;
  logout: () => void;
  setSseConnected: (v: boolean) => void;
}

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set) => ({
      user: null, token: null, isAuthenticated: false,
      sseConnected: false,
      setSseConnected: (v) => set({ sseConnected: v }),
      login: (token, user, refreshToken) => {
        Cookies.set('ch_kitchen_token', token, { expires: 1, sameSite: 'strict', path: '/', secure: window.location.protocol === 'https:' });
        if (refreshToken) Cookies.set('ch_kitchen_refresh', refreshToken, { expires: 7, sameSite: 'strict', path: '/', secure: window.location.protocol === 'https:' });
        set({ token, user, isAuthenticated: true });
      },
      logout: () => {
        Cookies.remove('ch_kitchen_token', { path: '/' });
        Cookies.remove('ch_kitchen_refresh', { path: '/' });
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    { name: 'cheezyhub-kitchen', partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }) }
  )
);
