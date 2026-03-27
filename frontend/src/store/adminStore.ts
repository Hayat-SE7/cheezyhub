// ─────────────────────────────────────────────────────────────────
//  Admin Store  (Zustand + persist)
//  Isolated from all other panels.
//  Cookie: ch_admin_token
// ─────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

interface AdminUser {
  id:       string;
  username: string;
  role:     string;
}

interface AdminState {
  user:            AdminUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  login:           (token: string, user: AdminUser) => void;
  logout:          () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,

      login: (token, user) => {
        Cookies.set('ch_admin_token', token, { expires: 7, sameSite: 'strict', path: '/' });
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        Cookies.remove('ch_admin_token', { path: '/' });
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name:       'ch-admin',
      partialize: (s) => ({
        user:            s.user,
        token:           s.token,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);
