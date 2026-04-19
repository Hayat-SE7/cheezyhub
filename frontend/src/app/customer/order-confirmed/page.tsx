'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ShoppingBag, Home, Clock } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
//  Inner component — useSearchParams() MUST live inside a component
//  that is wrapped by <Suspense>. Without this Next.js 14 crashes
//  during static generation because useSearchParams() reads from
//  the URL at render time, which isn't available during SSG.
// ─────────────────────────────────────────────────────────────────
function OrderConfirmedContent() {
  const params      = useSearchParams();
  const router      = useRouter();
  const orderNumber = params.get('order');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
        <CheckCircle className="text-emerald-400" size={44} />
      </div>

      <h1 className="font-display font-bold text-3xl text-[#f5d38e] mb-2">Order Confirmed!</h1>
      {orderNumber && (
        <p className="text-[#a07850] mb-1">
          Order <span className="font-semibold text-[#f5d38e]">#{orderNumber}</span>
        </p>
      )}
      <p className="text-[#a07850] text-sm mb-8 max-w-sm">
        Your order is being prepared. You'll receive updates as it progresses.
      </p>

      {/* Info pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
          <Clock size={14} /> Est. 25–35 min
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/customer/orders"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
        >
          <ShoppingBag size={16} /> Track Order
        </Link>
        <Link
          href="/customer"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#3d2a15] hover:bg-[#4a3520] text-[#f5d38e] font-semibold transition-colors border border-[#4a3520]"
        >
          <Home size={16} /> Home
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Page export — Suspense is required here so Next.js can
//  statically generate this route without crashing.
//  The fallback renders while the params are being read.
// ─────────────────────────────────────────────────────────────────
export default function OrderConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        </div>
      }
    >
      <OrderConfirmedContent />
    </Suspense>
  );
}
