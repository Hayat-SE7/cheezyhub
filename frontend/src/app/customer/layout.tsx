'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Home, ClipboardList, User, Headphones } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import LocationPopup from '@/components/customer/LocationPopup';

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Good night 🌙';
  if (h < 12) return 'Good morning ☀️';
  if (h < 17) return 'Good afternoon 🌤️';
  if (h < 21) return 'Good evening 🌆';
  return 'Good night 🌙';
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname        = usePathname();
  const itemCount       = useCartStore((s) => s.itemCount());
  const { isAuthenticated, user } = useAuthStore();

  const nav = [
    { href: '/customer',         icon: Home,          label: 'Menu' },
    { href: '/customer/orders',  icon: ClipboardList,  label: 'Orders' },
    { href: '/customer/support', icon: Headphones,     label: 'Support' },
    { href: '/customer/profile', icon: User,           label: 'Profile' },
  ];

  const isActive = (href: string) =>
    href === '/customer' ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass border-b border-white/60 shadow-sm shadow-amber-900/5">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo + greeting */}
          <Link href="/customer" className="flex items-center gap-2.5 group min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm shadow-md shadow-amber-400/30 group-hover:scale-105 transition-transform flex-shrink-0">
              🧀
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[15px] text-[#1c1714] leading-tight">CheezyHub</div>
              {isAuthenticated && (
                <div className="text-[10px] text-[#a39083] font-ui leading-tight truncate">
                  {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                </div>
              )}
            </div>
          </Link>

          {/* Cart button */}
          <Link
            href="/customer/cart"
            className="relative btn-press flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-md shadow-amber-400/30 transition-colors flex-shrink-0"
          >
            <ShoppingCart size={15} />
            {itemCount > 0
              ? <span className="font-display font-bold">{itemCount}</span>
              : <span className="opacity-70 font-ui">Cart</span>
            }
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-pop">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pb-28">
        {children}
      </main>

      {/* ── Bottom Navigation ────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-lg mx-auto px-3 pb-3">
          <div className="glass rounded-2xl shadow-xl shadow-black/10 overflow-hidden border border-white/70">
            <div className="flex">
              {nav.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors',
                      active ? 'text-amber-600' : 'text-[#a39083] hover:text-[#5c5147]'
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-x-2 inset-y-1 bg-amber-50 rounded-xl"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className="relative z-10">
                      <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                    </div>
                    <span className="relative z-10 text-[11px] font-ui font-semibold">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Location Popup — appears after login ─────────────── */}
      <LocationPopup isAuthenticated={isAuthenticated} />
    </div>
  );
}
