'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { orderApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmptyState } from '@/components/ui/EmptyState';

interface OrderItem {
  id: string;
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
  total: number;
  subtotal: number;
  deliveryFee: number;
  serviceCharge: number;
  deliveryAddress: string;
  createdAt: string;
  items: OrderItem[];
}

// Progress steps for the order tracking bar
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

function PastOrderCard({
  order,
  isExp,
  onToggle,
  onReorder,
}: {
  order: Order;
  isExp: boolean;
  onToggle: () => void;
  onReorder: (o: Order) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#ece6dc] overflow-hidden card-lift animate-slide-up">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={isExp}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
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
            ${order.total.toFixed(2)}
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
                  ${item.totalPrice.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[#ece6dc] space-y-1 text-xs text-[#a39083]">
            <div className="flex justify-between"><span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
            {order.deliveryFee > 0 && <div className="flex justify-between"><span>Delivery fee</span><span>${order.deliveryFee.toFixed(2)}</span></div>}
            {order.serviceCharge > 0 && <div className="flex justify-between"><span>Service charge</span><span>${order.serviceCharge.toFixed(2)}</span></div>}
            <div className="flex justify-between font-display font-bold text-[#1c1714] text-sm pt-1 border-t border-[#ece6dc]">
              <span>Total</span><span>${order.total.toFixed(2)}</span>
            </div>
          </div>

          {order.status === 'completed' && (
            <button
              onClick={() => onReorder(order)}
              className="btn-press mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-sm font-semibold border border-amber-200 transition-colors"
            >
              <RotateCcw size={14} /> Reorder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function VirtualPastList({
  past,
  expanded,
  onToggle,
  onReorder,
}: {
  past: Order[];
  expanded: string | null;
  onToggle: (id: string) => void;
  onReorder: (o: Order) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: past.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    measureElement: (el) => el.getBoundingClientRect().height + 12,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="max-h-[70vh] overflow-y-auto"
      style={{ contain: 'strict' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((vr) => {
          const order = past[vr.index];
          return (
            <div
              key={order.id}
              data-index={vr.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vr.start}px)`,
                paddingBottom: 12,
              }}
            >
              <PastOrderCard
                order={order}
                isExp={expanded === order.id}
                onToggle={() => onToggle(order.id)}
                onReorder={onReorder}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

export default function CustomerOrdersPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: orders = [], isLoading: loading } = useQuery<Order[]>({
    queryKey: ['my-orders'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await orderApi.getMyOrders();
      return res.data.data;
    },
  });

  useEffect(() => {
    if (!isAuthenticated) router.push('/customer/login');
  }, [isAuthenticated, router]);

  // Live order tracking via SSE
  useSSE({
    enabled: isAuthenticated,
    onEvent: {
      ORDER_UPDATED: (data: any) => {
        queryClient.invalidateQueries({ queryKey: ['my-orders'] });
        const label = STATUS_LABELS[data.status];
        if (label) {
          toast(label, {
            icon: '🧀',
            style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' },
            duration: 4000,
          });
        }
      },
    },
  });

  const handleReorder = (order: Order) => {
    let added = 0;
    for (const item of order.items) {
      addItem({
        menuItemId: item.id,
        name: item.menuItemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        selectedModifiers: item.selectedModifiers.map((m) => ({
          id: m.name,
          name: m.name,
          priceAdjustment: 0,
        })),
      });
      added++;
    }
    toast.success(`${added} item${added !== 1 ? 's' : ''} added to cart!`, { icon: '🛒' });
    router.push('/customer/cart');
  };

  const active = orders.filter((o) =>
    ['pending', 'preparing', 'ready', 'assigned', 'picked_up'].includes(o.status)
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
        <EmptyState icon={ShoppingBag} title="No orders yet" description="Your order history will appear here" action={{ label: 'Browse Menu', href: '/customer' }} className="py-20" />
      ) : (
        <div className="space-y-4">
          {/* Active Orders */}
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
                          ${order.total.toFixed(2)}
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

          {/* Past Orders */}
          {past.length > 0 && (
            <div>
              <h2 className="font-display font-bold text-sm text-[#5c5147] uppercase tracking-widest mb-3">
                Past Orders
              </h2>
              {past.length > 50 ? (
                <VirtualPastList
                  past={past}
                  expanded={expanded}
                  onToggle={(id) => setExpanded(expanded === id ? null : id)}
                  onReorder={handleReorder}
                />
              ) : (
                <div className="space-y-3">
                  {past.map((order) => (
                    <PastOrderCard
                      key={order.id}
                      order={order}
                      isExp={expanded === order.id}
                      onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
                      onReorder={handleReorder}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
