// ─────────────────────────────────────────────────────────
//  Delivery Store  — Phase 7
//  Isolated from authStore / counterStore.
//  Uses ch_delivery_token cookie exclusively.
// ─────────────────────────────────────────────────────────
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

export interface DeliveryUser {
  id:                 string;
  username:           string;
  fullName?:          string;
  role:               string;
  driverStatus:       'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';
  verificationStatus: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
  codPending:         number;
  activeOrderCount:   number;
  todayDeliveries?:   number;
  totalDeliveries?:   number;
}

interface DeliveryState {
  user:            DeliveryUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  sseConnected:    boolean;

  login:  (token: string, user: DeliveryUser, refreshToken?: string) => void;
  logout: () => void;
  updateStatus: (driverStatus: DeliveryUser['driverStatus']) => void;
  updateUser:   (partial: Partial<DeliveryUser>) => void;
  setSseConnected: (v: boolean) => void;
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,
      sseConnected:    false,

      setSseConnected: (v) => set({ sseConnected: v }),

      login: (token, user, refreshToken) => {
        Cookies.set('ch_delivery_token', token, { expires: 1, sameSite: 'strict', path: '/', secure: window.location.protocol === 'https:' });
        if (refreshToken) Cookies.set('ch_delivery_refresh', refreshToken, { expires: 7, sameSite: 'strict', path: '/', secure: window.location.protocol === 'https:' });
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        Cookies.remove('ch_delivery_token', { path: '/' });
        Cookies.remove('ch_delivery_refresh', { path: '/' });
        set({ token: null, user: null, isAuthenticated: false });
      },

      updateStatus: (driverStatus) =>
        set((s) => ({ user: s.user ? { ...s.user, driverStatus } : null })),

      updateUser: (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
    }),
    {
      name: 'cheezyhub-delivery',
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    }
  )
);
