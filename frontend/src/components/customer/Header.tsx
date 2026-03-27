'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { clsx } from 'clsx';
import { ShoppingCart, Menu, X, User, Package, HelpCircle, Tag, LogOut } from 'lucide-react';

const NAV_LINKS = [
  { href: '/customer/menu',    label: 'Menu',    icon: Package },
  { href: '/customer/deals',   label: 'Deals',   icon: Tag },
  { href: '/customer/orders',  label: 'Orders',  icon: Package },
  { href: '/customer/tickets', label: 'Support', icon: HelpCircle },
];

export default function Header() {
  const pathname = usePathname();
  const router   = useRouter();
  const { isAuthenticated, user, logout } = useAuthStore();
  const totalItems = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); router.push('/customer/login'); };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#ece6dc] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/customer" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-base shadow-md shadow-amber-400/20">🧀</div>
            <span className="font-display font-bold text-[#1c1714] text-lg">CheezyHub</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-amber-50 text-amber-700 font-semibold'
                    : 'text-[#5c5147] hover:text-[#1c1714] hover:bg-[#f5f0e8]',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop right */}
          <div className="hidden lg:flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/customer/profile" className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors', pathname === '/customer/profile' ? 'bg-amber-50 text-amber-700' : 'text-[#5c5147] hover:text-[#1c1714] hover:bg-[#f5f0e8]')}>
                  <User size={15} /> {user?.name?.split(' ')[0]}
                </Link>
                <button onClick={handleLogout} className="p-2 rounded-xl text-[#a39083] hover:text-red-500 hover:bg-red-50 transition-colors">
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <Link href="/customer/login" className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">
                Login
              </Link>
            )}

            {/* Cart */}
            <Link href="/customer/cart" className="relative p-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
              <ShoppingCart size={18} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] h-[18px] flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold rounded-full">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile: cart + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link href="/customer/cart" className="relative p-2 rounded-xl bg-amber-50 text-amber-700">
              <ShoppingCart size={18} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold rounded-full px-1">
                  {totalItems}
                </span>
              )}
            </Link>
            <button onClick={() => setMobileOpen((v) => !v)} className="p-2 rounded-xl text-[#5c5147] hover:bg-[#f5f0e8] transition-colors">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#ece6dc] bg-white px-4 pb-4 pt-2 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors', pathname.startsWith(href) ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-[#5c5147] hover:bg-[#f5f0e8]')}>
              <Icon size={16} /> {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-[#ece6dc]">
            {isAuthenticated ? (
              <>
                <Link href="/customer/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#5c5147] hover:bg-[#f5f0e8]">
                  <User size={16} /> My Profile
                </Link>
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 w-full">
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <Link href="/customer/login" onClick={() => setMobileOpen(false)} className="flex items-center justify-center py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm">
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
