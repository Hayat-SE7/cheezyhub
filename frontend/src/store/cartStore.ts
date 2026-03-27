import { create }  from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartModifier {
  id:              string;
  name:            string;
  priceAdjustment: number;
}

export interface CartItem {
  id:                string;
  menuItemId:        string;
  name:              string;
  imageUrl?:         string;
  quantity:          number;
  unitPrice:         number;
  totalPrice:        number;
  selectedModifiers: CartModifier[];
  notes?:            string;
}

export interface CartState {
  items: CartItem[];

  addItem:        (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem:     (id: string) => void;
  clearCart:      () => void;
  clear:          () => void;   // alias for clearCart (used by cart/page.tsx)
  total:          () => number;
  itemCount:      () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const id = `${item.menuItemId}-${Date.now()}`;
        set((s) => ({ items: [...s.items, { ...item, id }] }));
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
          return;
        }
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, quantity, totalPrice: i.unitPrice * quantity } : i
          ),
        }));
      },

      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clearCart:  ()   => set({ items: [] }),
      clear:      ()   => set({ items: [] }),

      total:     () => get().items.reduce((sum, i) => sum + i.totalPrice, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'cheezyhub-cart' }
  )
);
