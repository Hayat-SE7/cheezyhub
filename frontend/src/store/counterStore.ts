// ─────────────────────────────────────────────────────────────────
//  counterStore.ts  — CheezyHub POS / Counter panel
//
//  Auth fields match what counter/layout.tsx destructures:
//    const { theme, toggleTheme, isAuthenticated, user, logout } = useCounterStore()
//
//  Cookie: ch_counter_token
// ─────────────────────────────────────────────────────────────────
import { create }  from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies     from 'js-cookie';

export interface CounterCartModifier {
  id:              string;
  name:            string;
  priceAdjustment: number;
}

export interface CounterCartItem {
  id:                string;
  menuItemId:        string;
  name:              string;
  basePrice:         number;
  selectedModifiers: CounterCartModifier[];
  quantity:          number;
  notes:             string;
  lineTotal:         number;
}

export interface HeldOrder {
  id:    string;
  label: string;
  items: CounterCartItem[];
}

export interface CounterUser {
  id:        string;
  username:  string;
  role:      string;
  fullName?: string;
}

interface CounterState {
  // ── Auth (layout.tsx uses these names directly) ──────────────
  user:            CounterUser | null;
  token:           string | null;
  isAuthenticated: boolean;
  login:           (token: string, user: CounterUser, refreshToken?: string) => void;
  loginCounter:    (token: string, user: CounterUser, refreshToken?: string) => void; // alias
  logout:          () => void;

  // ── Cart ─────────────────────────────────────────────────────
  items:      CounterCartItem[];
  heldOrders: HeldOrder[];

  // ── Theme ────────────────────────────────────────────────────
  theme:       'light' | 'dark';
  toggleTheme: () => void;

  // ── Cart actions ─────────────────────────────────────────────
  addItem:     (item: Omit<CounterCartItem, 'id' | 'lineTotal'>) => void;
  updateQty:   (id: string, qty: number) => void;
  removeItem:  (id: string) => void;
  updateNotes: (id: string, notes: string) => void;
  clearCart:   () => void;
  clear:       () => void; // alias

  // ── Held order actions ───────────────────────────────────────
  holdOrder:   (label?: string) => void;
  recallOrder: (id: string) => void;
  discardHeld: (id: string) => void;

  // ── Computed ─────────────────────────────────────────────────
  subtotal:  () => number;
  itemCount: () => number;
}

function calcLineTotal(base: number, mods: CounterCartModifier[], qty: number) {
  return (base + mods.reduce((s, m) => s + m.priceAdjustment, 0)) * qty;
}

export const useCounterStore = create<CounterState>()(
  persist(
    (set, get) => ({
      // ── Auth ────────────────────────────────────────────────
      user:            null,
      token:           null,
      isAuthenticated: false,

      login: (token, user, refreshToken) => {
        Cookies.set('ch_counter_token', token, { expires: 1, sameSite: 'strict', path: '/', secure: window.location.protocol === 'https:' });
        if (refreshToken) Cookies.set('ch_counter_refresh', refreshToken, { expires: 7, sameSite: 'strict', path: '/', secure: window.location.protocol === 'https:' });
        set({ user, token, isAuthenticated: true });
      },

      loginCounter: (token, user, refreshToken) => get().login(token, user, refreshToken),

      logout: () => {
        Cookies.remove('ch_counter_token', { path: '/' });
        Cookies.remove('ch_counter_refresh', { path: '/' });
        set({ user: null, token: null, isAuthenticated: false, items: [], heldOrders: [] });
      },

      // ── Cart ────────────────────────────────────────────────
      items:      [],
      heldOrders: [],
      theme:      'dark',

      addItem: (raw) => {
        const id      = crypto.randomUUID();
        const lineTotal = calcLineTotal(raw.basePrice, raw.selectedModifiers, raw.quantity);
        set((s) => ({ items: [...s.items, { ...raw, id, lineTotal }] }));
      },

      updateQty: (id, qty) => {
        if (qty <= 0) {
          set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
          return;
        }
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? { ...i, quantity: qty, lineTotal: calcLineTotal(i.basePrice, i.selectedModifiers, qty) }
              : i
          ),
        }));
      },

      removeItem:  (id)      => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      updateNotes: (id, n)   => set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, notes: n } : i) })),
      clearCart:   ()        => set({ items: [] }),
      clear:       ()        => get().clearCart(),

      holdOrder: (label) => {
        const { items, heldOrders } = get();
        if (items.length === 0) return;
        set({
          heldOrders: [...heldOrders, { id: `held-${Date.now()}`, label: label ?? `Order ${heldOrders.length + 1}`, items: [...items] }],
          items: [],
        });
      },

      recallOrder: (id) => {
        const held = get().heldOrders.find((h) => h.id === id);
        if (!held) return;
        set((s) => ({ items: held.items, heldOrders: s.heldOrders.filter((h) => h.id !== id) }));
      },

      discardHeld: (id) => set((s) => ({ heldOrders: s.heldOrders.filter((h) => h.id !== id) })),

      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      subtotal:  () => get().items.reduce((s, i) => s + i.lineTotal, 0),
      itemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    {
      name:       'cheezyhub-counter',
      partialize: (s) => ({
        user:            s.user,
        token:           s.token,
        isAuthenticated: s.isAuthenticated,
        items:           s.items,
        heldOrders:      s.heldOrders,
        theme:           s.theme,
      }),
    }
  )
);
