// ─────────────────────────────────────────────────────────────────
//  Kitchen Store  (Zustand + persist)
//  Isolated from all other panels.
//  Cookie: ch_kitchen_token
// ─────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

interface KitchenUser {
  id:       string;
  username: string;
  role:     string;
}

interface KitchenState {
  user:            KitchenUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  login:           (token: string, user: KitchenUser) => void;
  logout:          () => void;
}

export const useKitchenStore = create<KitchenState>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,

      login: (token, user) => {
        Cookies.set('ch_kitchen_token', token, { expires: 7, sameSite: 'strict', path: '/' });
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        Cookies.remove('ch_kitchen_token', { path: '/' });
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name:       'ch-kitchen',
      partialize: (s) => ({
        user:            s.user,
        token:           s.token,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);
