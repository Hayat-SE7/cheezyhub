'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminStore } from '@/store/adminStore';
import { clsx } from 'clsx';
import Cookies from 'js-cookie';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Tag,
  Users, UserCog, Settings, MessageSquare, Truck, LogOut, BarChart2,
} from 'lucide-react';

const NAV = [
  { href: '/admin',           label: 'Dashboard',  icon: LayoutDashboard, exact: true },
  { href: '/admin/orders',    label: 'Orders',     icon: ShoppingBag },
  { href: '/admin/menu',      label: 'Menu',       icon: UtensilsCrossed },
  { href: '/admin/deals',     label: 'Deals',      icon: Tag },
  { href: '/admin/customers', label: 'Customers',  icon: Users },
  { href: '/admin/staff',     label: 'Staff',      icon: UserCog },
  { href: '/admin/drivers',   label: 'Drivers',    icon: Truck },       // ← was missing
  { href: '/admin/analytics', label: 'Analytics',  icon: BarChart2 },
  { href: '/admin/tickets',   label: 'Tickets',    icon: MessageSquare },
  { href: '/admin/settings',  label: 'Settings',   icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { isAuthenticated, user, logout } = useAdminStore();

  useEffect(() => {
    if (pathname === '/admin/login') return;

    // Primary check: Zustand store (survives page refresh via persist)
    if (!isAuthenticated) {
      router.replace('/admin/login');
      return;
    }

    // Secondary check: cookie must also exist (proves token is still valid)
    // If cookie expired but store still thinks we're logged in, redirect
    const cookie = Cookies.get('ch_admin_token');
    if (!cookie) {
      logout();                          // clear stale store state
      router.replace('/admin/login');
      return;
    }

    if (user?.role !== 'admin') {
      router.replace('/admin/login');
    }
  }, [isAuthenticated, user, pathname]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (!isAuthenticated) return null;

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen flex bg-[#09090F] text-[#F2F2F5]">
      {/* Sidebar — icon-only on <xl, expanded on xl+ */}
      <aside className="w-14 xl:w-52 flex-shrink-0 bg-[#0F0F1A] border-r border-[#1E1E32] flex flex-col transition-all duration-200">
        {/* Logo */}
        <div className="h-14 px-3 xl:px-5 border-b border-[#1E1E32] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-base shadow-lg shadow-amber-400/20 flex-shrink-0">🧀</div>
          <div className="hidden xl:block overflow-hidden">
            <div className="font-bold text-sm text-[#F2F2F5] leading-tight">CheezyHub</div>
            <div className="text-[10px] text-[#4A4A58]">Admin Panel</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={clsx(
                  'flex items-center gap-2.5 px-3 xl:px-4 py-2.5 mx-1 xl:mx-2 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#1E3A5F] text-[#60A5FA]'
                    : 'text-[#4A4A58] hover:text-[#F2F2F5] hover:bg-[#0F1420]'
                )}
              >
                <Icon size={16} className="flex-shrink-0" aria-hidden="true" />
                <span className="hidden xl:block truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 xl:px-4 py-3 border-t border-[#1E1E32]">
          <div className="hidden xl:block text-xs text-[#4A4A58] mb-2 truncate">{user?.username ?? 'Admin'}</div>
          <button
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="flex items-center gap-2 text-xs text-[#4A4A58] hover:text-red-400 transition-colors w-full"
          >
            <LogOut size={13} className="flex-shrink-0" />
            <span className="hidden xl:block">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
