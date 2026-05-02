'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useKitchenStore } from '@/store/kitchenStore';
import { LogOut, Wifi, WifiOff, UtensilsCrossed, History, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import Cookies from 'js-cookie';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout, sseConnected } = useKitchenStore();

  useEffect(() => {
    if (pathname === '/kitchen/login') return;
    if (!isAuthenticated) { router.replace('/kitchen/login'); return; }
    const cookie = Cookies.get('ch_kitchen_token');
    if (!cookie) { logout(); router.replace('/kitchen/login'); return; }
    if (user?.role !== 'kitchen' && user?.role !== 'admin') {
      router.replace('/kitchen/login');
    }
  }, [isAuthenticated, user, pathname, router, logout]);

  if (pathname === '/kitchen/login') return <>{children}</>;
  if (!isAuthenticated) return null;

  const handleLogout = () => {
    logout();
    Cookies.remove('ch_kitchen_token');
    router.push('/kitchen/login');
  };

  const navItems = [
    { href: '/kitchen',          label: 'Queue',    icon: UtensilsCrossed },
    { href: '/kitchen/history',  label: 'History',  icon: History },
    { href: '/kitchen/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#060607] flex flex-col">
      <header className="flex-shrink-0 h-11 flex items-center justify-between px-5 border-b border-[#1e1e22] bg-[#0a0a0d]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-sm shadow-md shadow-amber-400/30">🧀</div>
          <span className="font-bold text-sm text-[#f2f2f5]">CheezyHub</span>
          <span className="text-xs text-[#4a4a58]">Kitchen</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={clsx('flex items-center gap-1.5 text-xs', sseConnected ? 'text-emerald-400' : 'text-red-400')}>
            {sseConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {sseConnected ? 'Live' : 'Disconnected'}
          </div>
          <span className="text-xs text-[#4a4a58]">{user?.username ?? 'Kitchen'}</span>
          <button onClick={handleLogout} className="p-1.5 rounded-lg text-[#3a3a48] hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="flex-shrink-0 flex border-b border-[#1e1e22] bg-[#0a0a0d]">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/kitchen' ? pathname === '/kitchen' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors',
                active
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-[#4a4a58] hover:text-[#8a8a98]'
              )}
            >
              <Icon size={13} />
              {label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto"><ErrorBoundary>{children}</ErrorBoundary></main>
    </div>
  );
}
