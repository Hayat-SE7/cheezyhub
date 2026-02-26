'use client';

import { useState, useEffect } from 'react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { orderApi, paymentApi, publicSettingsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, MapPin, ChevronLeft, Banknote, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { clsx } from 'clsx';

type PaymentMethod = 'cash' | 'safepay';

export default function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, total } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [address,       setAddress]       = useState('');
  const [loading,       setLoading]       = useState(false);
  const [payMethod,     setPayMethod]     = useState<PaymentMethod>('cash');
  const [deliveryFee,   setDeliveryFee]   = useState<number | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [feesLoading,   setFeesLoading]   = useState(true);

  // Fetch real delivery fee from backend settings
  useEffect(() => {
    publicSettingsApi.getFees()
      .then((res) => {
        setDeliveryFee(res.data.data.deliveryFee ?? 0);
        setServiceCharge(res.data.data.serviceCharge ?? 0);
      })
      .catch(() => {
        // Fallback if API fails
        setDeliveryFee(0);
      })
      .finally(() => setFeesLoading(false));
  }, []);

  const subtotal    = total();
  const fee         = deliveryFee ?? 0;
  const grandTotal  = subtotal + fee + serviceCharge;

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      router.push('/customer/login');
      return;
    }
    if (!address.trim()) {
      toast.error('Please enter your delivery address');
      return;
    }
    if (feesLoading || deliveryFee === null) {
      toast.error('Loading fees, please wait...');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create the order
      const orderRes = await orderApi.place({
        items: items.map((i) => ({
          menuItemId:          i.menuItemId,
          quantity:            i.quantity,
          selectedModifierIds: i.selectedModifiers.map((m) => m.id),
          notes:               i.notes,
        })),
        deliveryAddress: address,
        paymentMethod:   payMethod,
      });

      const orderId = orderRes.data.data.id;

      // Step 2: Create payment record
      const payRes = await paymentApi.create(orderId, payMethod);

      clearCart();

      if (payMethod === 'cash') {
        // COD — order is confirmed, go to orders page
        toast.success('Order placed! 🎉');
        router.push('/customer/orders');
      } else {
        // Safepay — redirect customer to hosted checkout
        const checkoutUrl = payRes.data.data.checkoutUrl;
        if (!checkoutUrl) {
          throw new Error('No checkout URL returned');
        }
        toast('Redirecting to payment...', { icon: '💳' });
        window.location.href = checkoutUrl;
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="pt-12 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="font-display font-bold text-xl text-[#1a1612] mb-2">Your cart is empty</h2>
        <Link href="/customer" className="text-amber-600 text-sm font-semibold hover:underline">
          ← Back to menu
        </Link>
      </div>
    );
  }

  const btnLabel = () => {
    if (loading) return payMethod === 'cash' ? 'Placing order...' : 'Redirecting...';
    if (!isAuthenticated) return 'Sign in to Order';
    if (payMethod === 'cash') return `Place Order · Rs. ${grandTotal.toFixed(0)}`;
    return `Pay Online · Rs. ${grandTotal.toFixed(0)}`;
  };

  return (
    <div className="pt-5 pb-8">
      <div className="flex items-center gap-2 mb-5">
        <Link href="/customer" className="text-[#a8998e] hover:text-[#6b6057]">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-display font-bold text-xl text-[#1a1612]">Your Cart</h1>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2 mb-5">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl border border-[#e8e3da] p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="font-semibold text-[#1a1612] text-sm">{item.name}</div>
                {item.selectedModifiers.length > 0 && (
                  <div className="text-[#a8998e] text-xs mt-0.5">
                    {item.selectedModifiers.map((m) => m.name).join(', ')}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="text-[#c8bdb5] hover:text-red-400 ml-2 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-7 h-7 rounded-full border border-[#e8e3da] flex items-center justify-center hover:border-amber-400 transition-colors"
                >
                  <Minus size={12} />
                </button>
                <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-7 h-7 rounded-full border border-[#e8e3da] flex items-center justify-center hover:border-amber-400 transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
              <span className="font-bold text-amber-600">Rs. {item.totalPrice.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery Address */}
      <div className="bg-white rounded-2xl border border-[#e8e3da] p-4 mb-4">
        <div className="flex items-center gap-2 mb-2 text-[#6b6057]">
          <MapPin size={15} className="text-amber-500" />
          <span className="font-semibold text-sm">Delivery Address</span>
        </div>
        <textarea
          className="w-full text-sm text-[#1a1612] bg-[#fafaf8] rounded-xl border border-[#e8e3da] p-3 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none transition-all"
          rows={2}
          placeholder="Enter your full delivery address..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-2xl border border-[#e8e3da] p-4 mb-4">
        <div className="text-sm font-semibold text-[#6b6057] mb-3">Payment Method</div>
        <div className="grid grid-cols-2 gap-2">
          {/* Cash on Delivery */}
          <button
            onClick={() => setPayMethod('cash')}
            className={clsx(
              'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
              payMethod === 'cash'
                ? 'border-amber-500 bg-amber-50'
                : 'border-[#e8e3da] hover:border-amber-300'
            )}
          >
            <Banknote size={20} className={payMethod === 'cash' ? 'text-amber-600' : 'text-[#a8998e]'} />
            <span className={clsx(
              'text-xs font-semibold',
              payMethod === 'cash' ? 'text-amber-700' : 'text-[#6b6057]'
            )}>
              Cash on Delivery
            </span>
          </button>

          {/* Online Payment (Safepay) */}
          <button
            onClick={() => setPayMethod('safepay')}
            className={clsx(
              'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
              payMethod === 'safepay'
                ? 'border-amber-500 bg-amber-50'
                : 'border-[#e8e3da] hover:border-amber-300'
            )}
          >
            <CreditCard size={20} className={payMethod === 'safepay' ? 'text-amber-600' : 'text-[#a8998e]'} />
            <span className={clsx(
              'text-xs font-semibold',
              payMethod === 'safepay' ? 'text-amber-700' : 'text-[#6b6057]'
            )}>
              Pay Online
            </span>
          </button>
        </div>

        {payMethod === 'safepay' && (
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {['JazzCash', 'EasyPaisa', 'Visa', 'Mastercard'].map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 bg-[#f5f3ef] rounded-full text-[#6b6057] font-medium">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="bg-white rounded-2xl border border-[#e8e3da] p-4 mb-5">
        <div className="space-y-1.5 text-sm text-[#6b6057]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>Rs. {subtotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery fee</span>
            {feesLoading
              ? <span className="text-[#c8bdb5] text-xs">Loading...</span>
              : <span>Rs. {fee.toFixed(0)}</span>
            }
          </div>
          {serviceCharge > 0 && (
            <div className="flex justify-between">
              <span>Service charge</span>
              <span>Rs. {serviceCharge.toFixed(0)}</span>
            </div>
          )}
          <div className="border-t border-[#e8e3da] pt-2 mt-2 flex justify-between font-display font-bold text-[#1a1612]">
            <span>Total</span>
            <span>Rs. {grandTotal.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={loading || feesLoading}
        className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-2xl font-display font-bold transition-colors"
      >
        {btnLabel()}
      </button>
    </div>
  );
}
