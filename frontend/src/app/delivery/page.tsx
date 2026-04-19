'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeliveryStore } from '@/store/deliveryStore';
import { deliveryApi } from '@/lib/api';
import { useDeliverySSE } from '@/hooks/useDeliverySSE';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { MapPin, Phone, Navigation, AlertCircle, Package } from 'lucide-react';
import { clsx } from 'clsx';
import { EmptyState } from '@/components/ui/EmptyState';

interface Order {
  id:              string;
  orderNumber:     string;
  status:          string;
  total:           number;
  paymentMethod:   string;
  deliveryAddress: string;
  customer?:       { name: string; mobile?: string };
  items:           { menuItemName: string; quantity: number }[];
}

export default function DeliveryDashboard() {
  const { user, updateStatus, updateUser } = useDeliveryStore();
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState(false);

  const { data: orders = [], isLoading: loading, refetch: fetchOrders } = useQuery<Order[]>({
    queryKey: ['my-deliveries'],
    queryFn: async () => {
      const res = await deliveryApi.getMyOrders();
      return res.data.data;
    },
  });

  useDeliverySSE({
    NEW_DELIVERY_ASSIGNED: () => {
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      toast.success('New delivery assigned!', { icon: '🚴', duration: 6000 });
    },
    VERIFICATION_REVIEWED: (data: any) => {
      updateUser({ verificationStatus: data.status });
      if (data.status === 'VERIFIED') toast.success(data.message, { duration: 8000 });
      else toast.error(data.message, { duration: 8000 });
    },
    COD_SETTLED: (data: any) => {
      updateUser({ codPending: data.remainingAmount });
      toast.success(data.message);
    },
    HOLIDAY_REQUEST_REVIEWED: (data: any) => {
      if (data.status === 'APPROVED') toast.success(data.message, { icon: '✅', duration: 8000 });
      else toast.error(data.message, { duration: 8000 });
    },
  });

  const handleToggle = async () => {
    if (toggling) return;
    const nextStatus = user?.driverStatus === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    if (nextStatus === 'AVAILABLE' && user?.verificationStatus !== 'VERIFIED') {
      toast.error('Complete your profile verification first');
      return;
    }
    setToggling(true);
    try {
      await deliveryApi.setDriverStatus(nextStatus);
      updateStatus(nextStatus);
      toast.success(nextStatus === 'AVAILABLE' ? 'You are now online' : 'You are now offline');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  const handleMarkStatus = async (orderId: string, status: string) => {
    try {
      await deliveryApi.setStatus(orderId, status);
      toast.success(status === 'picked_up' ? 'Order picked up!' : 'Delivery completed!');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to update');
    }
  };

  const handleMaps = async (orderId: string) => {
    try {
      const res = await deliveryApi.getMapsUrl(orderId);
      window.open(res.data.data.mapsUrl, '_blank');
    } catch {}
  };

  const isOnline     = user?.driverStatus === 'AVAILABLE';
  const isOnDelivery = user?.driverStatus === 'ON_DELIVERY';
  const activeOrder  = orders[0] ?? null;

  return (
    <div className="flex flex-col min-h-[calc(100vh-112px)]">

      {/* ── Map Area ──────────────────────────────────────── */}
      <div className="relative flex-shrink-0 h-[38vh] bg-[#060E0C] overflow-hidden">
        {/* Google Maps iframe when active order has address */}
        {activeOrder?.deliveryAddress ? (
          <iframe
            title="Delivery map"
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(activeOrder.deliveryAddress)}&output=embed&z=15`}
          />
        ) : (
          /* Idle decorative background */
          <div
            className="absolute inset-0 opacity-60 bg-gradient-to-br from-[#0A1F1A] via-[#0D2420] to-[#060E0C]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 29px, rgba(0,212,170,0.06) 30px), repeating-linear-gradient(90deg, transparent, transparent 29px, rgba(0,212,170,0.06) 30px)',
            }}
          />
        )}

        {/* Dark overlay on top of map for readability */}
        {activeOrder?.deliveryAddress && (
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        )}

        {/* ETA / status badge — centred */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {activeOrder ? (
            <div className="bg-[#0D2420]/90 border border-[#00D4AA]/30 rounded-2xl px-6 py-3 text-center backdrop-blur-sm shadow-xl">
              <div className="text-xs text-[#00D4AA]/60 mb-0.5 uppercase tracking-widest font-mono">Navigating to</div>
              <div className="text-sm font-bold text-white max-w-[200px] truncate">{activeOrder.deliveryAddress}</div>
              <button
                onClick={() => handleMaps(activeOrder.id)}
                className="pointer-events-auto mt-2 flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-[#00D4AA]/20 border border-[#00D4AA]/40 text-[#00D4AA] text-xs font-bold hover:bg-[#00D4AA]/30 transition-colors"
              >
                <Navigation size={11} /> Open in Google Maps
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className={clsx('text-3xl font-black tracking-tight', isOnline ? 'text-[#00D4AA]' : 'text-[#3A6A60]')}>
                {isOnDelivery ? 'On Delivery' : isOnline ? 'Online' : 'Offline'}
              </div>
              <div className="text-xs text-[#3A6A60] mt-1">
                {isOnline ? 'Waiting for orders…' : 'Toggle to go online'}
              </div>
            </div>
          )}
        </div>

        {/* Online/Offline toggle — top right */}
        {!isOnDelivery && (
          <div className="absolute top-3 right-3 z-10">
            <button
              role="switch"
              aria-checked={isOnline}
              aria-label={isOnline ? 'Go offline' : 'Go online'}
              onClick={handleToggle}
              disabled={toggling}
              className={clsx(
                'relative w-14 h-8 rounded-full transition-all duration-300 flex-shrink-0 shadow-lg',
                toggling ? 'opacity-60' : '',
                isOnline ? 'bg-[#00D4AA]' : 'bg-[#1E3830]'
              )}
            >
              <span className={clsx(
                'absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all duration-300',
                isOnline ? 'left-[calc(100%-1.75rem)]' : 'left-1'
              )} />
            </button>
          </div>
        )}

        {/* Verification warning overlay */}
        {user?.verificationStatus !== 'VERIFIED' && !isOnline && (
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <Link href="/delivery/profile">
              <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2 backdrop-blur-sm">
                <AlertCircle size={12} />
                <span>
                  {user?.verificationStatus === 'UNDER_REVIEW'
                    ? 'Verification under review — we\'ll notify you'
                    : 'Complete profile verification to go online →'}
                </span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* ── Active Order Card ─────────────────────────────── */}
      <div className="p-4 border-b border-[#00D4AA]/10">
        {loading ? (
          <div className="h-32 rounded-2xl bg-[#0D1F1B] animate-pulse" />
        ) : activeOrder ? (
          <div className="bg-[#0D1F1B] border border-[#00D4AA]/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-[#3A6A60]">#{activeOrder.orderNumber}</span>
                <div className={clsx(
                  'text-xs mt-0.5 px-2 py-0.5 rounded-full inline-block font-medium',
                  activeOrder.status === 'assigned'  ? 'bg-amber-400/10 text-amber-400' :
                  activeOrder.status === 'picked_up' ? 'bg-blue-400/10 text-blue-400' : ''
                )}>
                  {activeOrder.status === 'assigned' ? 'Ready to pick up' : 'On the way'}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[#F2F2F5] font-black text-lg">Rs. {Math.round(activeOrder.total)}</p>
                <p className={clsx('text-[10px] mt-0.5', activeOrder.paymentMethod === 'cash' ? 'text-[#00D4AA]' : 'text-[#3A6A60]')}>
                  {activeOrder.paymentMethod === 'cash' ? 'COD' : 'Paid Online'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-[#4A8A7A]">
              <MapPin size={13} className="mt-0.5 flex-shrink-0 text-[#3A6A60]" />
              <span className="leading-relaxed">{activeOrder.deliveryAddress}</span>
            </div>

            {activeOrder.customer && (
              <div className="flex items-center gap-2 text-xs text-[#3A6A60]">
                <span>{activeOrder.customer.name}</span>
                {activeOrder.customer.mobile && (
                  <a href={`tel:${activeOrder.customer.mobile}`} className="flex items-center gap-1 text-[#00D4AA]/70 hover:text-[#00D4AA]">
                    <Phone size={11} /> {activeOrder.customer.mobile}
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleMaps(activeOrder.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/20 text-[#00D4AA] text-xs font-semibold hover:bg-[#00D4AA]/20 transition-colors"
              >
                <Navigation size={13} /> Navigate
              </button>

              {activeOrder.status === 'assigned' && (
                <button
                  onClick={() => handleMarkStatus(activeOrder.id, 'picked_up')}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
                >
                  Picked Up ✓
                </button>
              )}

              {activeOrder.status === 'picked_up' && (
                <button
                  onClick={() => handleMarkStatus(activeOrder.id, 'delivered')}
                  className="flex-1 py-2.5 rounded-xl bg-[#00D4AA] text-[#070E0D] text-xs font-bold hover:bg-[#00B890] transition-colors"
                >
                  Delivered ✓
                </button>
              )}
            </div>

            {/* Additional orders in queue */}
            {orders.length > 1 && (
              <div className="pt-2 border-t border-[#00D4AA]/10">
                <p className="text-[10px] text-[#3A6A60] mb-1.5">+{orders.length - 1} more in queue</p>
                {orders.slice(1).map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-[#4A8A7A]">#{order.orderNumber}</span>
                    <span className="text-xs font-bold text-[#00D4AA]">Rs. {Math.round(order.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title={isOnline ? 'Waiting for orders' : 'You are offline'}
            description={isOnline ? 'New deliveries will appear here automatically' : 'Toggle online to start receiving deliveries'}
            dark
            className="py-8"
          />
        )}
      </div>

      {/* ── Stats Row ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="bg-[#0D1F1B] border border-[#00D4AA]/10 rounded-xl p-3 text-center">
          <div className="text-xl font-black text-[#00D4AA] tabular">{user?.todayDeliveries ?? 0}</div>
          <div className="text-[10px] text-[#4A8A7A] mt-0.5">Today</div>
        </div>
        <div className="bg-[#0D1F1B] border border-[#00D4AA]/10 rounded-xl p-3 text-center">
          <div className="text-xl font-black text-[#00D4AA] tabular">{user?.totalDeliveries ?? 0}</div>
          <div className="text-[10px] text-[#4A8A7A] mt-0.5">Total</div>
        </div>
        <div className="bg-[#0D1F1B] border border-[#00D4AA]/10 rounded-xl p-3 text-center">
          <div className="text-xl font-black text-[#00D4AA] tabular">Rs. {Math.round(user?.codPending ?? 0)}</div>
          <div className="text-[10px] text-[#4A8A7A] mt-0.5">COD Due</div>
        </div>
      </div>
    </div>
  );
}
