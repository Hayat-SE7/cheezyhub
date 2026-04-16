'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingCart, Home, ClipboardList, User, Headphones,
  Menu, X,
} from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import LocationPopup from '@/components/customer/LocationPopup';
import Footer from '@/components/customer/Footer';
import { brand } from '@/config/brand';

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Good night 🌙';
  if (h < 12) return 'Good morning ☀️';
  if (h < 17) return 'Good afternoon 🌤️';
  if (h < 21) return 'Good evening 🌆';
  return 'Good night 🌙';
}

const desktopNav = [
  { href: '/customer',         label: 'Menu' },
  { href: '/customer/orders',  label: 'My Orders' },
  { href: '/customer/support', label: 'Support' },
  { href: '/customer/profile', label: 'Profile' },
];

const mobileNav = [
  { href: '/customer',         icon: Home,          label: 'Menu' },
  { href: '/customer/orders',  icon: ClipboardList, label: 'Orders' },
  { href: '/customer/support', icon: Headphones,    label: 'Support' },
  { href: '/customer/profile', icon: User,          label: 'Profile' },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const itemCount = useCartStore((s) => s.itemCount());
  const { isAuthenticated, user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/customer' ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-[#100C07] flex flex-col">

      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#1A1208] border-b border-[#3D2E12]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/customer" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm shadow-md shadow-amber-400/30 group-hover:scale-105 transition-transform">
              {brand.emoji}
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[15px] text-[#F5E6C8] leading-tight">{brand.name}</div>
              {isAuthenticated && (
                <div className="text-[10px] text-[#A0886A] font-ui leading-tight truncate hidden sm:block">
                  {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                </div>
              )}
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {desktopNav.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'px-3.5 py-2 rounded-xl text-sm font-semibold font-ui transition-all',
                    active
                      ? 'bg-[#2D1F08] text-[#D97706] border border-[#D97706]/30'
                      : 'text-[#7A6040] hover:text-[#F5E6C8] hover:bg-[#1A1208]'
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/customer/cart"
              className="relative btn-press flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-md shadow-amber-400/30 transition-colors"
            >
              <ShoppingCart size={15} />
              {itemCount > 0
                ? <span className="font-display font-bold">{itemCount}</span>
                : <span className="opacity-70 font-ui hidden sm:inline">Cart</span>
              }
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-scale-pop">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
            <button
              className="lg:hidden p-2 rounded-xl text-[#A0886A] hover:text-[#F5E6C8] hover:bg-[#2D1F08] transition-colors"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={19} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ──────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed inset-y-0 right-0 z-50 w-72 bg-[#0F0A04] shadow-2xl flex flex-col border-l border-[#3D2E12]"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#3D2E12]">
                <span className="font-display font-bold text-[#F5E6C8]">{brand.name}</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-[#7A6040] hover:text-[#F5E6C8] hover:bg-[#2D1F08] transition-all">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {desktopNav.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={clsx(
                      'flex items-center px-4 py-3 rounded-xl text-sm font-semibold font-ui transition-all',
                      isActive(href) ? 'bg-[#2D1F08] text-[#D97706] border border-[#D97706]/30' : 'text-[#7A6040] hover:text-[#F5E6C8] hover:bg-[#1A1208]'
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN ───────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-28 lg:pb-8 pt-2">
        {children}
      </main>

      {/* Footer — desktop only */}
      <div className="hidden lg:block">
        <Footer />
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        <div className="max-w-lg mx-auto px-3 pb-3">
          <div className="bg-[#0F0A04] border border-[#3D2E12] rounded-2xl shadow-xl shadow-black/40 overflow-hidden">
            <div className="flex">
              {mobileNav.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors',
                      active ? 'text-[#D97706]' : 'text-[#7A6040] hover:text-[#A0886A]'
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-x-2 inset-y-1 bg-[#2D1F08] rounded-xl"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className="relative z-10"><Icon size={19} strokeWidth={active ? 2.5 : 1.8} /></div>
                    <span className="relative z-10 text-[11px] font-ui font-semibold">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {isAuthenticated && user?.role === 'customer' && (
        <LocationPopup isAuthenticated={isAuthenticated} />
      )}
    </div>
  );
}
