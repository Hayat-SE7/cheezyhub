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
  lastValidated: number | null;

  addItem:        (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem:     (id: string) => void;
  clearCart:      () => void;
  clear:          () => void;
  total:          () => number;
  itemCount:      () => number;
  validateCart:   () => Promise<string[]>;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      lastValidated: null,

      addItem: (item) => {
        const id = crypto.randomUUID();
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

      /**
       * Validates cart items against the current menu.
       * Removes invalid items and returns a list of removed item names.
       * Should be called on app mount / before checkout.
       */
      validateCart: async () => {
        const { items } = get();
        if (items.length === 0) return [];

        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/menu`);
          const json = await res.json();
          if (!json.success) return [];

          const categories = json.data as any[];
          // Build a map of valid menuItemId → item data (including modifier IDs)
          const validItems = new Map<string, { isAvailable: boolean; modifierIds: Set<string> }>();
          for (const cat of categories) {
            for (const item of cat.items ?? []) {
              const modIds = new Set<string>();
              for (const group of item.modifierGroups ?? []) {
                for (const mod of group.modifiers ?? []) {
                  if (mod.isAvailable) modIds.add(mod.id);
                }
              }
              validItems.set(item.id, { isAvailable: item.isAvailable, modifierIds: modIds });
            }
          }

          const removedNames: string[] = [];
          const validCartItems: CartItem[] = [];

          for (const cartItem of items) {
            const menuItem = validItems.get(cartItem.menuItemId);

            // Item doesn't exist or is unavailable
            if (!menuItem || !menuItem.isAvailable) {
              removedNames.push(cartItem.name);
              continue;
            }

            // Check if all selected modifiers still exist and are available
            const invalidMods = cartItem.selectedModifiers.filter(
              (m) => !menuItem.modifierIds.has(m.id)
            );

            if (invalidMods.length > 0) {
              removedNames.push(`${cartItem.name} (unavailable options)`);
              continue;
            }

            validCartItems.push(cartItem);
          }

          if (removedNames.length > 0) {
            set({ items: validCartItems, lastValidated: Date.now() });
          } else {
            set({ lastValidated: Date.now() });
          }

          return removedNames;
        } catch {
          // Network error — don't remove anything
          return [];
        }
      },
    }),
    { name: 'cheezyhub-cart' }
  )
);
