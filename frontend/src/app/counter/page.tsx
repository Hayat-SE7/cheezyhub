'use client';
// ─────────────────────────────────────────────────────────────────
//  Counter POS Page — Phase 12
//  ✅ Full offline-aware placeOrder (queues when offline)
//  ✅ Optimistic order list with "queued" badge
//  ✅ Offline banner with queue count
//  ✅ Queue-full warning (50 cap)
//  ✅ SSE listener for menu_updated → auto-refetch
//  ✅ All Phase 1 POS features preserved
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueueStore } from '@/store/offlineQueueStore';
import { counterApi } from '@/lib/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import {
  Plus, Minus, Trash2, ShoppingCart, ChevronRight,
  Check, WifiOff, Clock, AlertTriangle, RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
interface Modifier   { id: string; name: string; priceAdjustment: number; isAvailable: boolean; }
interface ModGroup   { id: string; name: string; required: boolean; multiSelect: boolean; modifiers: Modifier[]; }
interface MenuItem   { id: string; name: string; description?: string; basePrice: number; imageUrl?: string; isAvailable: boolean; modifierGroups: ModGroup[]; }
interface Category   { id: string; name: string; items: MenuItem[]; }

interface CartLine {
  key:                 string;
  menuItemId:          string;
  name:                string;
  quantity:            number;
  unitPrice:           number;
  totalPrice:          number;
  selectedModifierIds: string[];
  selectedModifierNames: string[];
  paymentMethod:       'cash' | 'card';
}

interface LocalOrder {
  id:          string;
  orderNumber: string;
  total:       number;
  items:       { name: string; qty: number }[];
  status:      'placed' | 'queued' | 'failed';
  createdAt:   Date;
}

// ─── Main component ───────────────────────────────────────────────
export default function CounterPage() {
  const { isOnline, isOffline, status } = useOnlineStatus();
  const { enqueue, pendingCount, isFull, items: queueItems } = useOfflineQueueStore();

  const [categories,    setCategories]    = useState<Category[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [cart,          setCart]          = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [customerNote,  setCustomerNote]  = useState('');
  const [placing,       setPlacing]       = useState(false);
  const [localOrders,   setLocalOrders]   = useState<LocalOrder[]>([]);
  const [selectedItem,  setSelectedItem]  = useState<MenuItem | null>(null);
  const [selectedMods,  setSelectedMods]  = useState<Record<string, string[]>>({});
  const [qty,           setQty]           = useState(1);

  // SSE for menu updates
  const sseRef = useRef<EventSource | null>(null);

  const loadMenu = useCallback(() => {
    counterApi.getMenu()
      .then((r) => {
        const cats = r.data.data ?? [];
        setCategories(cats);
        if (cats[0] && !activeCategory) setActiveCategory(cats[0].id);
      })
      .catch(() => toast.error('Failed to load menu'))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => { loadMenu(); }, []);

  // Counter SSE — listen for menu_updated
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    const Cookies = require('js-cookie');
    const token   = Cookies.get('ch_counter_token');
    if (!token) return;

    const es = new EventSource(`${apiBase}/counter/sse?token=${token}`);
    sseRef.current = es;
    es.addEventListener('menu_updated', () => {
      toast('Menu updated — refreshing', { icon: '🔄', duration: 2000 });
      loadMenu();
    });
    return () => es.close();
  }, [loadMenu]);

  // ─── Cart helpers ─────────────────────────────────────────────
  const cartTotal = cart.reduce((s, l) => s + l.totalPrice, 0);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  const addToCart = (item: MenuItem) => {
    const selectedModifierNames = Object.values(selectedMods).flat().map((id) => {
      return item.modifierGroups.flatMap((g) => g.modifiers).find((m) => m.id === id)?.name ?? '';
    }).filter(Boolean);
    const modPrice = Object.values(selectedMods).flat().reduce((s, id) => {
      const mod = item.modifierGroups.flatMap((g) => g.modifiers).find((m) => m.id === id);
      return s + (mod?.priceAdjustment ?? 0);
    }, 0);

    const unitPrice  = item.basePrice + modPrice;
    const allModIds  = Object.values(selectedMods).flat();
    const key        = `${item.id}:${allModIds.sort().join(',')}`;

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => l.key === key ? { ...l, quantity: l.quantity + qty, totalPrice: (l.quantity + qty) * unitPrice } : l);
      }
      return [...prev, {
        key, menuItemId: item.id, name: item.name, quantity: qty,
        unitPrice, totalPrice: unitPrice * qty,
        selectedModifierIds: allModIds, selectedModifierNames,
        paymentMethod,
      }];
    });

    setSelectedItem(null); setSelectedMods({}); setQty(1);
    toast.success(`${item.name} added`, { duration: 1000 });
  };

  const updateQty  = (key: string, n: number) => {
    if (n <= 0) { setCart((p) => p.filter((l) => l.key !== key)); return; }
    setCart((p) => p.map((l) => l.key === key ? { ...l, quantity: n, totalPrice: n * l.unitPrice } : l));
  };
  const removeLine = (key: string) => setCart((p) => p.filter((l) => l.key !== key));
  const clearCart  = () => setCart([]);

  // ─── Place order ──────────────────────────────────────────────
  const placeOrder = async () => {
    if (!cart.length) { toast.error('Cart is empty'); return; }
    setPlacing(true);

    const items = cart.map((l) => ({
      menuItemId:          l.menuItemId,
      name:                l.name,
      quantity:            l.quantity,
      unitPrice:           l.unitPrice,
      selectedModifierIds: l.selectedModifierIds,
    }));

    // ── OFFLINE path ──────────────────────────────────────────
    if (isOffline || status === 'reconnecting') {
      if (isFull()) {
        toast.error('Offline queue is full (50 orders). Please sync before adding more.');
        setPlacing(false);
        return;
      }

      const idempotencyKey = uuidv4();
      const ok = await enqueue({
        type:             'order',
        endpoint:         '/counter/sync',
        method:           'POST',
        payload:          { orders: [{ idempotencyKey, offlineCreatedAt: new Date().toISOString(), paymentMethod, customerNote: customerNote || undefined, items, total: cartTotal }] },
        localLabel:       `Order Rs. ${cartTotal.toFixed(0)}`,
        id:               idempotencyKey,
        idempotencyKey,
        offlineCreatedAt: new Date().toISOString(),
        paymentMethod,
        customerNote:     customerNote || undefined,
        items,
        total:            cartTotal,
      });

      if (ok) {
        const localOrder: LocalOrder = {
          id:          idempotencyKey,
          orderNumber: `Q-${idempotencyKey.slice(-6).toUpperCase()}`,
          total:       cartTotal,
          items:       cart.map((l) => ({ name: l.name, qty: l.quantity })),
          status:      'queued',
          createdAt:   new Date(),
        };
        setLocalOrders((p) => [localOrder, ...p]);
        clearCart();
        setCustomerNote('');
        toast(`Order queued (${pendingCount() + 1} in queue)`, { icon: '📴', duration: 3000 });
      } else {
        toast.error('Queue full — cannot add more offline orders');
      }
      setPlacing(false);
      return;
    }

    // ── ONLINE path ───────────────────────────────────────────
    try {
      const res = await counterApi.placeOrder({
        items: cart.map((l) => ({
          menuItemId:          l.menuItemId,
          quantity:            l.quantity,
          selectedModifierIds: l.selectedModifierIds,
        })),
        customerNote: customerNote || undefined,
        paymentMethod,
      });

      const order = res.data.data;
      const localOrder: LocalOrder = {
        id:          order.id,
        orderNumber: order.orderNumber,
        total:       order.total,
        items:       cart.map((l) => ({ name: l.name, qty: l.quantity })),
        status:      'placed',
        createdAt:   new Date(),
      };
      setLocalOrders((p) => [localOrder, ...p]);
      clearCart();
      setCustomerNote('');
      toast.success(`Order ${order.orderNumber} placed!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  // Fixed dark theme — Bento Grid
  const bg        = 'bg-[#09090E]';
  const card      = 'bg-[#0F0F14] border-[#1E1E28]';
  const text      = 'text-[#F2F2F5]';
  const sub       = 'text-[#4A4A58]';
  const itemBg    = 'bg-[#0F0F14] hover:bg-[#161620] border-[#1E1E28]';
  const inputCls  = 'bg-[#0F0F14] border-[#1E1E28] text-[#F2F2F5] placeholder-[#3A3A48]';

  // Category items
  const currentCategory = categories.find((c) => c.id === activeCategory);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090E]">
        <div className="text-center text-[#4A4A58]">
          <div className="text-4xl mb-3 animate-bounce">🧀</div>
          <p className="text-sm">Loading menu…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-[#09090E]">
      {/* ── Category sidebar ── */}
      <div className="flex-shrink-0 overflow-auto flex flex-row md:flex-col md:w-36 border-b md:border-b-0 md:border-r bg-[#0F0F14] border-[#1E1E28]">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={clsx('px-3 py-3 text-left text-xs font-semibold transition-colors whitespace-nowrap md:whitespace-normal border-b-2 md:border-b-0 md:border-l-2',
              activeCategory === cat.id
                ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                : 'border-transparent text-[#9898A5] hover:text-[#F2F2F5] hover:bg-[#161620]'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* ── Menu grid ── */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Offline banner */}
        {isOffline && (
          <div className="mb-3 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <WifiOff size={15} />
            <div>
              <span className="font-semibold">Offline mode</span>
              <span className="ml-2 text-xs text-red-400/70">Orders will be saved and synced when you reconnect · {pendingCount()} queued</span>
            </div>
          </div>
        )}

        {isFull() && (
          <div className="mb-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <AlertTriangle size={14} />
            <span className="font-semibold">Queue full</span>
            <span className="text-xs opacity-70 ml-1">— sync before adding more offline orders</span>
          </div>
        )}

        {/* Menu items */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {currentCategory?.items.map((item) => (
            <button
              key={item.id}
              disabled={!item.isAvailable}
              onClick={() => {
                if (item.modifierGroups.length > 0) { setSelectedItem(item); setSelectedMods({}); setQty(1); }
                else addToCart(item);
              }}
              className={clsx(
                'flex flex-col p-3 rounded-xl border text-left transition-all',
                item.isAvailable ? itemBg : clsx('opacity-40 cursor-not-allowed', card),
              )}
            >
              <span className={clsx('font-semibold text-sm leading-snug mb-1', text)}>{item.name}</span>
              {item.description && <span className={clsx('text-[11px] leading-snug mb-2 line-clamp-2', sub)}>{item.description}</span>}
              <span className="font-bold text-amber-500 text-sm mt-auto">Rs. {item.basePrice.toFixed(0)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Cart panel ── */}
      <div className="w-72 flex-shrink-0 border-l border-[#1E1E28] flex flex-col bg-[#0F0F14]">
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E28]">
          <div className="flex items-center gap-2">
            <ShoppingCart size={15} className="text-amber-400" />
            <span className={clsx('font-display font-bold text-sm', text)}>Cart</span>
            {cartCount > 0 && <span className="text-xs font-bold px-1.5 py-0.5 bg-amber-500 text-white rounded-full">{cartCount}</span>}
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className={clsx('text-xs', sub, 'hover:text-red-400 transition-colors')}>Clear</button>
          )}
        </div>

        {/* Cart lines */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {cart.length === 0 ? (
            <div className={clsx('text-center py-12 text-sm', sub)}>
              <ShoppingCart size={28} className="mx-auto mb-2 opacity-20" />
              Tap items to add
            </div>
          ) : (
            cart.map((line) => (
              <div key={line.key} className={clsx('rounded-xl border p-2.5', card)}>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className={clsx('font-semibold text-xs leading-snug', text)}>{line.name}</p>
                    {line.selectedModifierNames.length > 0 && (
                      <p className={clsx('text-[10px] mt-0.5', sub)}>{line.selectedModifierNames.join(', ')}</p>
                    )}
                  </div>
                  <button onClick={() => removeLine(line.key)} className={clsx('flex-shrink-0', sub, 'hover:text-red-400')}>
                    <Trash2 size={11} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(line.key, line.quantity - 1)} className="w-6 h-6 rounded-lg bg-[#1e1e28] flex items-center justify-center text-[#9898a5] hover:text-white">
                      <Minus size={10} />
                    </button>
                    <span className={clsx('text-xs font-bold w-5 text-center', text)}>{line.quantity}</span>
                    <button onClick={() => updateQty(line.key, line.quantity + 1)} className="w-6 h-6 rounded-lg bg-[#1e1e28] flex items-center justify-center text-[#9898a5] hover:text-white">
                      <Plus size={10} />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-amber-400">Rs. {line.totalPrice.toFixed(0)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order panel */}
        <div className="px-3 py-3 border-t border-[#1E1E28] space-y-3">
          {/* Payment method */}
          <div className="flex rounded-lg overflow-hidden border border-[#1E1E28]">
            {(['cash', 'card'] as const).map((m) => (
              <button key={m} onClick={() => setPaymentMethod(m)} className={clsx('flex-1 py-1.5 text-xs font-semibold capitalize transition-colors', paymentMethod === m ? 'bg-amber-500 text-white' : 'text-[#9898A5] hover:text-[#F2F2F5]')}>
                {m}
              </button>
            ))}
          </div>

          {/* Note */}
          <input
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="Note (optional)"
            className={clsx('w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-amber-500/40', inputCls)}
          />

          {/* Total + Place */}
          <div className={clsx('flex items-center justify-between text-sm font-bold', text)}>
            <span>Total</span>
            <span className="text-amber-400">Rs. {cartTotal.toFixed(0)}</span>
          </div>

          <button
            onClick={placeOrder}
            disabled={placing || !cart.length || isFull()}
            className={clsx(
              'w-full py-3 rounded-xl font-display font-bold text-sm transition-all',
              isOffline
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-400/20',
              'disabled:opacity-50',
            )}
          >
            {placing ? 'Processing…' : isOffline ? `📴 Queue Order · Rs. ${cartTotal.toFixed(0)}` : `Place Order · Rs. ${cartTotal.toFixed(0)}`}
          </button>
        </div>

        {/* Recent orders */}
        {localOrders.length > 0 && (
          <div className="border-t border-[#1E1E28] px-3 py-2 max-h-48 overflow-y-auto">
            <p className={clsx('text-[10px] font-semibold uppercase tracking-wide mb-1.5', sub)}>Recent</p>
            {localOrders.slice(0, 10).map((o) => (
              <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-[#1e1e28] last:border-0">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={clsx('text-xs font-semibold', text)}>{o.orderNumber}</span>
                    {o.status === 'queued' && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-full font-bold border border-amber-500/20">QUEUED</span>
                    )}
                    {o.status === 'placed' && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-bold border border-emerald-500/20">SENT</span>
                    )}
                  </div>
                  <p className={clsx('text-[10px]', sub)}>{format(o.createdAt, 'h:mm a')}</p>
                </div>
                <span className="text-xs font-bold text-amber-400">Rs. {o.total.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modifier modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border shadow-2xl bg-[#0F0F14] border-[#1E1E28]">
            <div className="px-5 py-4 border-b border-[#1e1e28]">
              <h3 className={clsx('font-display font-bold text-lg', text)}>{selectedItem.name}</h3>
              <p className="text-amber-400 font-bold text-sm">Rs. {selectedItem.basePrice.toFixed(0)}</p>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-64 overflow-y-auto">
              {selectedItem.modifierGroups.map((group) => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className={clsx('font-semibold text-sm', text)}>{group.name}</p>
                    {group.required && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-full font-bold border border-amber-500/20">Required</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.modifiers.filter((m) => m.isAvailable).map((mod) => {
                      const active = selectedMods[group.id]?.includes(mod.id);
                      return (
                        <button key={mod.id} onClick={() => {
                          setSelectedMods((prev) => {
                            const cur = prev[group.id] ?? [];
                            if (group.multiSelect) {
                              return { ...prev, [group.id]: active ? cur.filter((id) => id !== mod.id) : [...cur, mod.id] };
                            }
                            return { ...prev, [group.id]: active ? [] : [mod.id] };
                          });
                        }} className={clsx('flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all', active ? 'bg-amber-500 text-white border-amber-500' : 'bg-[#1E1E28] text-[#9898A5] border-[#2E2E38] hover:border-amber-500/40')}>
                          {active && <Check size={10} />}
                          {mod.name}{mod.priceAdjustment > 0 && ` +${mod.priceAdjustment.toFixed(0)}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-[#1e1e28] flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 rounded-lg bg-[#1e1e28] flex items-center justify-center text-[#9898a5] hover:text-white"><Minus size={13} /></button>
                <span className={clsx('font-bold w-6 text-center', text)}>{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-8 h-8 rounded-lg bg-[#1e1e28] flex items-center justify-center text-[#9898a5] hover:text-white"><Plus size={13} /></button>
              </div>
              <button onClick={() => { setSelectedItem(null); setSelectedMods({}); setQty(1); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors bg-[#1E1E28] text-[#9898A5] hover:text-[#F2F2F5]">Cancel</button>
              <button onClick={() => addToCart(selectedItem)} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
