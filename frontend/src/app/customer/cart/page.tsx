'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { orderApi, addressApi } from '@/lib/api';
import Image from 'next/image';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Minus, Plus, Trash2, ShoppingCart, MapPin, ChevronRight } from 'lucide-react';

export default function CartPage() {
  const router   = useRouter();
  const { items, updateQuantity, removeItem, clear } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [placing, setPlacing] = useState(false);
  const [note,    setNote]    = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Fetch their default address on mount
  useEffect(() => {
    if (isAuthenticated) {
      addressApi.getAll().then(res => {
        const addrs = res.data.data;
        if (addrs && addrs.length > 0) {
          const def = addrs.find((a: any) => a.isDefault) || addrs[0];
          setDeliveryAddress(def.addressText || '');
        }
      }).catch(() => {});
    }
  }, [isAuthenticated]);

  const subtotal     = items.reduce((s, i) => s + i.totalPrice, 0);
  const deliveryFee  = subtotal >= 1500 ? 0 : 150;
  const total        = subtotal + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) { router.push('/customer/login'); return; }
    if (!items.length) { toast.error('Cart is empty'); return; }
    if (deliveryAddress.trim().length < 5) {
      toast.error('Please provide a full delivery address');
      return;
    }
    setPlacing(true);
    try {
      const res = await orderApi.create({
        items: items.map((i) => ({
          menuItemId:          i.menuItemId,
          quantity:            i.quantity,
          selectedModifierIds: i.selectedModifiers.map((m) => m.id),
          notes:               note || undefined, // applies to item
        })),
        deliveryAddress: deliveryAddress.trim(),
        notes: note || undefined, // overarching order note
      });
      clear();
      const orderNum = res.data.data?.orderNumber ?? '';
      router.push(`/customer/order-confirmed?order=${orderNum}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Order failed. Please try again.');
    } finally { setPlacing(false); }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShoppingCart size={56} className="text-[#d5c8bc] mb-4" />
        <h2 className="font-display font-bold text-2xl text-[#1c1714] mb-2">Cart is empty</h2>
        <p className="text-[#a39083] mb-6">Add some cheesy goodness to get started!</p>
        <button onClick={() => router.push('/customer/menu')} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors">
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-[#1c1714] mb-6">Your Cart</h1>

      {/* 2-col on desktop */}
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start space-y-6 lg:space-y-0">
        {/* Items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 bg-white rounded-2xl border border-[#ece6dc] p-4">
              {item.imageUrl ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-amber-50 flex items-center justify-center text-2xl">🍔</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1c1714] text-sm">{item.name}</p>
                {item.selectedModifiers.length > 0 && (
                  <p className="text-xs text-[#a39083] mt-0.5">{item.selectedModifiers.map((m) => m.name).join(', ')}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-lg border border-[#ece6dc] bg-white flex items-center justify-center hover:bg-gray-50">
                      <Minus size={12} className="text-[#5c5147]" />
                    </button>
                    <span className="font-semibold text-[#1c1714] w-7 text-center text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-lg border border-[#ece6dc] bg-white flex items-center justify-center hover:bg-gray-50">
                      <Plus size={12} className="text-[#5c5147]" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-600 text-sm">Rs. {item.totalPrice.toFixed(0)}</span>
                    <button onClick={() => removeItem(item.id)} className="text-[#d5c8bc] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Addresses and Notes */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#ece6dc] p-4">
              <label className="block text-sm font-semibold text-[#1c1714] mb-2 flex items-center gap-1.5 hover:text-amber-500 transition-colors">
                <MapPin size={15} className="text-amber-500" /> Delivery Address
              </label>
              <textarea 
                value={deliveryAddress} 
                onChange={(e) => setDeliveryAddress(e.target.value)} 
                placeholder="Enter complete delivery address" 
                rows={2} 
                className="w-full px-3 py-2 rounded-xl bg-[#faf9f6] border border-[#ece6dc] text-[#1c1714] text-sm placeholder-[#a39083] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none transition-all" 
              />
            </div>
            
            <div className="bg-white rounded-2xl border border-[#ece6dc] p-4">
              <label className="block text-sm font-semibold text-[#1c1714] mb-2">Order note (optional)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Special requests, allergies, etc." rows={2} className="w-full px-3 py-2 rounded-xl bg-[#faf9f6] border border-[#ece6dc] text-[#1c1714] text-sm placeholder-[#a39083] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none transition-all" />
            </div>
          </div>
        </div>

        {/* Sticky summary */}
        <div className="lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-[#ece6dc] p-5 space-y-4">
            <h2 className="font-display font-bold text-lg text-[#1c1714]">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#5c5147]">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-[#5c5147]">
                <span>Delivery</span>
                <span className={deliveryFee === 0 ? 'text-emerald-600 font-semibold' : ''}>{deliveryFee === 0 ? 'Free' : `Rs. ${deliveryFee}`}</span>
              </div>
              {deliveryFee > 0 && subtotal < 1500 && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                  Add Rs. {(1500 - subtotal).toFixed(0)} more for free delivery
                </p>
              )}
              <div className="border-t border-[#ece6dc] pt-2 flex justify-between font-bold text-[#1c1714]">
                <span>Total</span>
                <span>Rs. {total.toFixed(0)}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-display font-bold text-base shadow-md shadow-amber-400/20 transition-all disabled:opacity-60"
            >
              {placing ? 'Placing order…' : !isAuthenticated ? 'Login to Order' : `Place Order · Rs. ${total.toFixed(0)}`}
            </button>

            <button onClick={clear} className="w-full text-center text-xs text-[#a39083] hover:text-red-400 transition-colors">
              Clear cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
