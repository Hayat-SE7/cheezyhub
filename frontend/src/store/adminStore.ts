// ─────────────────────────────────────────────────────────────────
//  adminStore.ts  — CheezyHub Admin Panel
//
//  ROOT CAUSE FIX: This store MUST set 'ch_admin_token' cookie on
//  login, because:
//    1. The _admin axios instance (api.ts) reads ch_admin_token for
//       every API request — if it's missing, every call 401s
//    2. useAdminSSE reads ch_admin_token to connect the SSE stream
//    3. The admin layout checks isAuthenticated to decide whether
//       to render or redirect to /admin/login
//
//  If ch_admin_token is never set, the dashboard loads briefly then
//  all API calls fail, charts show nothing, and SSE never connects.
// ─────────────────────────────────────────────────────────────────

import { create }  from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies     from 'js-cookie';

export interface AdminUser {
  id:        string;
  username:  string;
  role:      string;
  fullName?: string;
}

interface AdminState {
  user:            AdminUser | null;
  token:           string | null;
  isAuthenticated: boolean;

  login:  (token: string, user: AdminUser, refreshToken?: string) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,

      login: (token, user, refreshToken) => {
        Cookies.set('ch_admin_token', token, {
          expires:  1,
          sameSite: 'strict',
          path:     '/',
          secure:   window.location.protocol === 'https:',
        });
        if (refreshToken) Cookies.set('ch_admin_refresh', refreshToken, { expires: 7, sameSite: 'strict', path: '/', secure: window.location.protocol === 'https:' });
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        Cookies.remove('ch_admin_token', { path: '/' });
        Cookies.remove('ch_admin_refresh', { path: '/' });
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'cheezyhub-admin',
      // Persist auth state so page refreshes don't log user out
      partialize: (s) => ({
        user:            s.user,
        token:           s.token,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);
