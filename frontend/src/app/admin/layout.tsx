'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed,
  Users, HeadphonesIcon, Settings, LogOut,
  Menu, X, Tag, ChevronRight, SlidersHorizontal,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/admin',           icon: LayoutDashboard,    label: 'Dashboard',  exact: true },
  { href: '/admin/orders',    icon: ShoppingBag,         label: 'Orders' },
  { href: '/admin/menu',      icon: UtensilsCrossed,     label: 'Menu' },
  { href: '/admin/modifiers', icon: SlidersHorizontal,   label: 'Modifiers' }, // NEW
  { href: '/admin/deals',     icon: Tag,                 label: 'Deals' },
  { href: '/admin/staff',     icon: Users,               label: 'Staff' },
  { href: '/admin/tickets',   icon: HeadphonesIcon,      label: 'Support' },
  { href: '/admin/settings',  icon: Settings,            label: 'Settings' },
];

function NavLink({ href, icon: Icon, label, exact, onClick }: {
  href: string; icon: any; label: string; exact?: boolean; onClick?: () => void;
}) {
  const pathname = usePathname();
  const active   = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        'group relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl mb-1 text-sm font-ui font-semibold transition-all duration-200',
        active
          ? 'sidebar-item-active'
          : 'text-white/35 hover:text-white/75 sidebar-item-hover border border-transparent'
      )}
    >
      <Icon size={16} className={clsx('flex-shrink-0', active ? 'text-amber-400' : 'text-current')} strokeWidth={active ? 2.2 : 1.8} />
      <span>{label}</span>
      {active && <ChevronRight size={13} className="ml-auto text-amber-400/60" />}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname();
  const router      = useRouter();
  const logout      = useAuthStore((s) => s.logout);
  const user        = useAuthStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === '/admin/login') {
    return <div className="dark-ui">{children}</div>;
  }

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <div className="dark-ui min-h-screen bg-[#07070a] flex relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-amber-500/4 blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-amber-600/3 blur-3xl animate-float" />
      </div>

      <button
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl glass-dark border border-white/8 flex items-center justify-center text-white/70 hover:text-white transition-colors shadow-lg"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={18} />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        <aside
          className={clsx(
            'sidebar-glass flex-shrink-0 flex flex-col z-50 transition-transform duration-300',
            'lg:relative lg:translate-x-0 lg:w-60',
            'fixed inset-y-0 left-0 w-72',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
            <Link href="/admin" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl glass-amber flex items-center justify-center text-lg shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                🧀
              </div>
              <div>
                <div className="font-display font-bold text-white text-[15px] leading-tight">CheezyHub</div>
                <div className="text-white/25 text-[11px] font-ui">Admin Panel</div>
              </div>
            </Link>
            <button
              className="lg:hidden p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 p-3 overflow-y-auto">
            <div className="mb-3 px-1">
              <span className="text-[9px] font-bold text-white/15 uppercase tracking-[0.2em] font-ui">Navigation</span>
            </div>
            {navItems.map(({ href, icon, label, exact }) => (
              <NavLink
                key={href}
                href={href}
                icon={icon}
                label={label}
                exact={exact}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </nav>

          <div className="p-3 border-t border-white/5">
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white/4 border border-white/6 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {(user?.username ?? user?.name ?? 'A')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white/75 text-sm font-semibold font-ui truncate">{user?.username ?? user?.name ?? 'Admin'}</div>
                <div className="text-white/25 text-[11px] font-ui">Administrator</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-2xl text-sm font-ui font-semibold text-white/30 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/15 transition-all"
            >
              <LogOut size={15} strokeWidth={1.8} />
              Sign Out
            </button>
          </div>
        </aside>
      </AnimatePresence>

      <main className="flex-1 overflow-auto relative lg:pl-0 pt-0">
        <div className="lg:hidden h-16" />
        {children}
      </main>
    </div>
  );
}
