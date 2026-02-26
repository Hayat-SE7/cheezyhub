'use client';

import { useEffect, useState, Suspense } from 'react';
import { orderApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, ShoppingBag, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedModifiers: { name: string }[];
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  serviceCharge: number;
  deliveryAddress: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_STEPS = ['pending', 'preparing', 'ready', 'assigned', 'picked_up', 'completed'];
const STATUS_LABELS: Record<string, string> = {
  pending:   '📋 Order Placed',
  preparing: '👨‍🍳 Being Prepared',
  ready:     '✅ Ready',
  assigned:  '🛵 Driver Assigned',
  picked_up: '📦 On the Way',
  completed: '🎉 Delivered!',
  cancelled: '❌ Cancelled',
};
const STATUS_DESCS: Record<string, string> = {
  pending:   'Your order is in the queue',
  preparing: 'Chef is making your food',
  ready:     'Packed and waiting for driver',
  assigned:  'Driver is heading to pick up',
  picked_up: 'Your food is on its way!',
  completed: 'Enjoy your meal!',
  cancelled: 'This order was cancelled',
};

function OrderProgressBar({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-center text-red-500 text-sm font-semibold">
        ❌ Order Cancelled
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(status);

  return (
    <div className="mt-4">
      <div className="text-center mb-3">
        <div className="font-display font-bold text-[#1c1714] text-sm">
          {STATUS_LABELS[status] ?? status}
        </div>
        <div className="text-[#a39083] text-xs mt-0.5">{STATUS_DESCS[status]}</div>
      </div>
      <div className="relative flex items-center">
        {STATUS_STEPS.map((step, idx) => (
          <div key={step} className="flex-1 flex items-center">
            <div
              className={clsx(
                'w-3 h-3 rounded-full flex-shrink-0 z-10 transition-all duration-500',
                idx <= currentIdx
                  ? idx === currentIdx
                    ? 'bg-amber-500 ring-4 ring-amber-100 scale-125'
                    : 'bg-amber-400'
                  : 'bg-[#ece6dc]'
              )}
            />
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className={clsx(
                  'h-0.5 flex-1 transition-all duration-700',
                  idx < currentIdx ? 'bg-amber-400' : 'bg-[#ece6dc]'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Payment awaiting banner ──────────────────────────
function AwaitingPaymentBanner({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
      <Clock size={14} className="text-blue-500 flex-shrink-0" />
      <div>
        <div className="text-blue-700 text-xs font-semibold">Awaiting Payment</div>
        <div className="text-blue-500 text-[11px]">
          Order #{orderNumber} is held until payment is confirmed.
        </div>
      </div>
    </div>
  );
}

// ─── Inner component — can use useSearchParams safely ─
function OrdersContent() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addItem = useCartStore((s) => s.addItem);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/customer/login'); return; }
    orderApi.getMyOrders()
      .then((res) => {
        setOrders(res.data.data);

        // ── Handle Safepay redirect-back URL params ─────
        // Safepay adds ?payment=success&order=<orderId> on success
        //             ?payment=cancelled              on cancel
        const paymentParam = searchParams.get('payment');
        const orderId      = searchParams.get('order');

        if (paymentParam === 'success') {
          const orders: Order[] = res.data.data;
          const targetOrder = orderId ? orders.find((o) => o.id === orderId) : null;
          const label = targetOrder
            ? `Payment confirmed for #${targetOrder.orderNumber} 🎉`
            : 'Payment confirmed! 🎉';
          toast.success(label, { duration: 5000 });
          // Remove query params from URL without reload
          window.history.replaceState({}, '', '/customer/orders');
        } else if (paymentParam === 'cancelled') {
          toast.error('Payment was cancelled. Your order is on hold.', { duration: 5000 });
          window.history.replaceState({}, '', '/customer/orders');
        }
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, router, searchParams]);

  // Live order tracking via SSE
  useSSE({
    enabled: isAuthenticated,
    onEvent: {
      ORDER_UPDATED: (data: any) => {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === data.orderId ? { ...o, status: data.status } : o
          )
        );
        const label = STATUS_LABELS[data.status];
        if (label) {
          toast(label, {
            icon: '🧀',
            style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' },
            duration: 4000,
          });
        }
      },

      // ── Safepay payment confirmed ─────────────────────
      // When Safepay webhook fires, backend sends this to the customer.
      // We update the order's paymentStatus and show a toast.
      PAYMENT_CONFIRMED: (data: any) => {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === data.orderId
              ? { ...o, paymentStatus: 'paid' }
              : o
          )
        );
        toast.success(`Payment confirmed for #${data.orderNumber}! 🎉`, {
          duration: 5000,
          style: { background: '#f0fdf4', color: '#166534', border: '1px solid #86efac' },
        });
      },

      // ── Safepay payment failed ─────────────────────────
      PAYMENT_FAILED: (data: any) => {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === data.orderId
              ? { ...o, paymentStatus: 'failed', status: 'cancelled' }
              : o
          )
        );
        toast.error(`Payment failed — order cancelled. ${data.reason ?? ''}`, {
          duration: 6000,
        });
      },
    },
  });

  // ── Reorder handler ───────────────────────────────────
  // NOTE: We do NOT carry over selectedModifiers because snapshots
  // don't store modifier IDs — only names. Passing fake IDs would
  // break the inventory validation on order placement.
  // Customer sees items in cart and can re-select modifiers.
  const handleReorder = (order: Order) => {
    let added = 0;
    for (const item of order.items) {
      addItem({
        menuItemId:        item.menuItemId,
        name:              item.menuItemName,
        quantity:          item.quantity,
        unitPrice:         item.unitPrice,
        totalPrice:        item.unitPrice * item.quantity, // recalculate without modifier prices
        selectedModifiers: [], // ✅ intentionally empty — modifier IDs not in snapshot
      });
      added++;
    }
    toast.success(`${added} item${added !== 1 ? 's' : ''} added to cart!`, { icon: '🛒' });
    router.push('/customer/cart');
  };

  // Pending Safepay orders (awaiting payment) shown separately
  const awaitingPayment = orders.filter((o) => o.paymentStatus === 'pending');
  const active = orders.filter((o) =>
    ['pending', 'preparing', 'ready', 'assigned', 'picked_up'].includes(o.status) &&
    o.paymentStatus !== 'pending' // exclude unconfirmed Safepay orders
  );
  const past = orders.filter((o) => ['completed', 'cancelled'].includes(o.status));

  if (!isAuthenticated) return null;

  return (
    <div className="pt-5">
      <h1 className="font-display font-bold text-2xl text-[#1c1714] mb-5">My Orders</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={48} className="mx-auto mb-4 text-[#d9cfc0]" />
          <h2 className="font-display font-bold text-[#1c1714] text-lg">No orders yet</h2>
          <p className="text-[#a39083] text-sm mt-1">Your order history will appear here</p>
          <button
            onClick={() => router.push('/customer')}
            className="mt-5 px-6 py-3 bg-amber-500 text-white rounded-xl font-display font-bold text-sm hover:bg-amber-600 transition-colors"
          >
            Browse Menu
          </button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Awaiting Payment ─────────────────────── */}
          {awaitingPayment.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-blue-400" />
                <h2 className="font-display font-bold text-sm text-blue-500 uppercase tracking-widest">
                  Awaiting Payment
                </h2>
              </div>
              <div className="space-y-3">
                {awaitingPayment.map((order) => (
                  <div key={order.id} className="bg-white rounded-2xl border border-blue-100 p-5">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <span className="font-mono text-xs text-[#a39083]">{order.orderNumber}</span>
                        <div className="font-display font-bold text-[#1c1714] text-sm mt-0.5">
                          Rs. {Math.round(order.total)}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 border border-blue-100 font-bold">
                        Pending Payment
                      </span>
                    </div>
                    <AwaitingPaymentBanner orderNumber={order.orderNumber} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Active Orders ─────────────────────────── */}
          {active.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 pulse-dot" />
                <h2 className="font-display font-bold text-sm text-[#5c5147] uppercase tracking-widest">
                  Live Tracking
                </h2>
              </div>
              <div className="space-y-3">
                {active.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-[#ece6dc] p-5 shadow-md shadow-amber-900/5 animate-slide-up"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <span className="font-mono text-xs text-[#a39083]">{order.orderNumber}</span>
                        <div className="font-display font-bold text-amber-600 text-sm mt-0.5">
                          Rs. {Math.round(order.total)}
                        </div>
                      </div>
                      <span className="text-[11px] text-[#a39083]">
                        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <OrderProgressBar status={order.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Past Orders ───────────────────────────── */}
          {past.length > 0 && (
            <div>
              <h2 className="font-display font-bold text-sm text-[#5c5147] uppercase tracking-widest mb-3">
                Past Orders
              </h2>
              <div className="space-y-3">
                {past.map((order) => {
                  const isExp = expanded === order.id;
                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-[#ece6dc] overflow-hidden card-lift animate-slide-up"
                    >
                      <div
                        className="flex items-center gap-4 p-4 cursor-pointer"
                        onClick={() => setExpanded(isExp ? null : order.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-[#a39083]">{order.orderNumber}</span>
                            <span className={clsx(
                              'text-[10px] px-2 py-0.5 rounded-full font-bold capitalize',
                              order.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-red-50 text-red-500 border border-red-100'
                            )}>
                              {order.status}
                            </span>
                          </div>
                          <div className="text-xs text-[#a39083] mt-1">
                            {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·{' '}
                            {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-3">
                          <span className="font-display font-bold text-amber-600">
                            Rs. {Math.round(order.total)}
                          </span>
                          {isExp ? <ChevronUp size={14} className="text-[#a39083]" /> : <ChevronDown size={14} className="text-[#a39083]" />}
                        </div>
                      </div>

                      {isExp && (
                        <div className="border-t border-[#ece6dc] px-4 pb-4 animate-fade-in">
                          <div className="mt-4 space-y-2.5">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-[#1c1714] text-sm font-medium">
                                    {item.quantity}× {item.menuItemName}
                                  </div>
                                  {item.selectedModifiers.length > 0 && (
                                    <div className="text-[11px] text-[#a39083] mt-0.5">
                                      {item.selectedModifiers.map((m) => m.name).join(' · ')}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[#5c5147] text-sm flex-shrink-0">
                                  Rs. {Math.round(item.totalPrice)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 pt-3 border-t border-[#ece6dc] space-y-1 text-xs text-[#a39083]">
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span>Rs. {Math.round(order.subtotal)}</span>
                            </div>
                            {order.deliveryFee > 0 && (
                              <div className="flex justify-between">
                                <span>Delivery fee</span>
                                <span>Rs. {Math.round(order.deliveryFee)}</span>
                              </div>
                            )}
                            {order.serviceCharge > 0 && (
                              <div className="flex justify-between">
                                <span>Service charge</span>
                                <span>Rs. {Math.round(order.serviceCharge)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-display font-bold text-[#1c1714] text-sm pt-1 border-t border-[#ece6dc]">
                              <span>Total</span>
                              <span>Rs. {Math.round(order.total)}</span>
                            </div>
                          </div>

                          {order.status === 'completed' && (
                            <button
                              onClick={() => handleReorder(order)}
                              className="btn-press mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-sm font-semibold border border-amber-200 transition-colors"
                            >
                              <RotateCcw size={14} /> Reorder
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js App Router
export default function CustomerOrdersPage() {
  return (
    <Suspense fallback={<div className="pt-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}</div>}>
      <OrdersContent />
    </Suspense>
  );
}
