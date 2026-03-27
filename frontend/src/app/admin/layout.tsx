'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdminStore } from '@/store/adminStore';
import { clsx } from 'clsx';
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
    if (!isAuthenticated) { router.replace('/admin/login'); return; }
    if (user?.role !== 'admin') { router.replace('/admin/login'); }
  }, [isAuthenticated, user, pathname]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (!isAuthenticated) return null;

  const handleLogout = () => { logout(); router.push('/admin/login'); };

  return (
    <div className="min-h-screen flex bg-[#07070a] text-[#f2f2f5]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#0c0c0e] border-r border-[#1e1e28] flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-[#1e1e28]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-base shadow-lg shadow-amber-400/20">🧀</div>
            <div>
              <div className="font-bold text-sm text-[#f2f2f5] leading-tight">CheezyHub</div>
              <div className="text-[10px] text-[#4a4a58]">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={clsx('flex items-center gap-2.5 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium transition-colors', active ? 'bg-amber-500/10 text-amber-400' : 'text-[#9898a5] hover:text-[#f2f2f5] hover:bg-[#1a1a24]')}>
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#1e1e28]">
          <div className="text-xs text-[#4a4a58] mb-2">{user?.username ?? 'Admin'}</div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-[#4a4a58] hover:text-red-400 transition-colors w-full">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
