'use client';

import { useQuery } from '@tanstack/react-query';
import { kitchenApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

interface OrderItem {
  menuItemName: string;
  quantity:     number;
}

interface Order {
  id:          string;
  orderNumber: string;
  status:      string;
  orderType:   string;
  total:       number;
  items:       OrderItem[];
  updatedAt:   string;
  createdAt:   string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  completed: { label: 'Completed', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'text-red-400 bg-red-500/10 border-red-500/20',             icon: XCircle },
};

export default function KitchenHistoryPage() {
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['kitchen-history'],
    queryFn:  async () => {
      const res = await kitchenApi.getHistory();
      return res.data.data.items;
    },
    staleTime: 30_000,
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <Clock size={15} className="text-amber-500" />
        <h1 className="font-bold text-[#f2f2f5] text-sm uppercase tracking-wider">Order History</h1>
        {!isLoading && (
          <span className="ml-auto text-xs text-[#4a4a58]">{orders.length} orders</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-[#0f0f14] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon="📋" title="No history yet" description="Completed and cancelled orders will appear here" />
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.completed;
            const Icon  = badge.icon;
            return (
              <div
                key={order.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#0f0f14] border border-[#1e1e28] hover:border-[#2a2a38] transition-colors"
              >
                {/* Order # */}
                <div className="w-20 flex-shrink-0">
                  <div className="font-black text-[#f2f2f5] text-sm">{order.orderNumber}</div>
                  <div className="text-[10px] text-[#4a4a58] capitalize">{order.orderType.replace('_', ' ')}</div>
                </div>

                {/* Items summary */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#9898a5] truncate">
                    {order.items.map((i) => `×${i.quantity} ${i.menuItemName}`).join(' · ')}
                  </div>
                </div>

                {/* Total */}
                <div className="text-xs font-bold text-amber-400 flex-shrink-0">
                  Rs. {order.total.toFixed(0)}
                </div>

                {/* Status badge */}
                <div className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold flex-shrink-0', badge.cls)}>
                  <Icon size={10} />
                  {badge.label}
                </div>

                {/* Time */}
                <div className="text-[10px] text-[#4a4a58] flex-shrink-0 w-20 text-right">
                  {formatDistanceToNow(new Date(order.updatedAt), { addSuffix: true })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
