'use client';

import { useState, useEffect, useCallback } from 'react';
import { deliveryApi } from '@/lib/api';
import { Package, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface Order {
  id: string; orderNumber: string; status: string; total: number;
  paymentMethod: string; deliveryAddress: string; updatedAt: string;
  customer?: { name: string };
  items: { menuItemName: string; quantity: number }[];
}

export default function DeliveryHistoryPage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotal]  = useState(1);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await deliveryApi.getHistory(p);
      const d   = res.data.data;
      setOrders(d.items);
      setTotal(d.totalPages);
      setPage(p);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPage(1); }, []);

  return (
    <div className="px-4 pt-5 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Order History</h1>
        <p className="text-xs text-zinc-500">Past deliveries</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-zinc-900 animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-14 text-zinc-700">
          <Package size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No deliveries yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-white">#{o.orderNumber}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(o.updatedAt).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' })}
                      {o.customer && ` · ${o.customer.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">Rs.{Math.round(o.total)}</p>
                      <p className={clsx('text-[10px]', o.paymentMethod === 'cash' ? 'text-amber-400' : 'text-zinc-500')}>
                        {o.paymentMethod === 'cash' ? 'Cash' : 'Online'}
                      </p>
                    </div>
                    <ChevronRight size={14} className={clsx('text-zinc-600 transition-transform', expanded === o.id && 'rotate-90')} />
                  </div>
                </button>

                {expanded === o.id && (
                  <div className="px-4 pb-3 border-t border-zinc-800 pt-2 space-y-1">
                    <p className="text-xs text-zinc-500">{o.deliveryAddress}</p>
                    <p className="text-xs text-zinc-600">
                      {o.items.map(i => `${i.quantity}× ${i.menuItemName}`).join(', ')}
                    </p>
                    <span className={clsx(
                      'inline-block text-[10px] px-2 py-0.5 rounded-full border mt-1',
                      o.status === 'completed' || o.status === 'delivered'
                        ? 'bg-lime-400/5 border-lime-400/20 text-lime-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                    )}>
                      {o.status}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => fetchPage(page - 1)}
                className="text-xs text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs text-zinc-600">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => fetchPage(page + 1)}
                className="text-xs text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
