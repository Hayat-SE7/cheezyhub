'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDeliveryStore } from '@/store/deliveryStore';
import { useDeliverySSE } from '@/hooks/useDeliverySSE';
import {
  LayoutDashboard, Package, Wallet, User, CalendarDays,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const NAV = [
  { href: '/delivery',            icon: LayoutDashboard, label: 'Home'    },
  { href: '/delivery/history',    icon: Package,         label: 'Orders'  },
  { href: '/delivery/cod-wallet', icon: Wallet,          label: 'Wallet'  },
  { href: '/delivery/holidays',   icon: CalendarDays,    label: 'Days Off' },
  { href: '/delivery/profile',    icon: User,            label: 'Profile' },
];

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { isAuthenticated, user, updateUser } = useDeliveryStore();

  // Auth guard
  useEffect(() => {
    if (pathname === '/delivery/login') return;
    if (!isAuthenticated) { router.replace('/delivery/login'); return; }
    if (user?.role !== 'delivery') {
      toast.error('Driver access only');
      router.replace('/delivery/login');
    }
  }, [isAuthenticated, user, pathname]);

  if (pathname === '/delivery/login') return <>{children}</>;
  if (!isAuthenticated) return null;

  const isActive = (href: string) =>
    href === '/delivery' ? pathname === '/delivery' : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-[#070E0D] text-[#F2F2F5] flex flex-col">
      {/* Top bar */}
      <header className="flex-shrink-0 h-12 flex items-center justify-between px-4 border-b border-[#00D4AA]/10 bg-[#0D1F1B]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#00D4AA]/10 border border-[#00D4AA]/20 flex items-center justify-center text-xs">
            🚴
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#F2F2F5]">CheezyHub</span>
          <span className="text-xs text-[#00D4AA]/60">Driver</span>
        </div>

        <div className="flex items-center gap-2">
          {!['/delivery/earnings', '/delivery/settlements'].some(p => pathname.startsWith(p)) && (
            <Link
              href="/delivery/earnings"
              className="text-[10px] text-[#3A6A60] hover:text-[#00D4AA] transition-colors"
            >
              Earnings
            </Link>
          )}
          <div className={clsx(
            'text-xs px-2.5 py-0.5 rounded-full font-medium border',
            user?.driverStatus === 'AVAILABLE'   ? 'bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/20' :
            user?.driverStatus === 'ON_DELIVERY' ? 'bg-blue-400/10 text-blue-400 border-blue-400/20' :
                                                   'bg-[#0D1F1B] text-[#3A6A60] border-[#1E3830]'
          )}>
            {user?.driverStatus === 'AVAILABLE'   ? '● Online' :
             user?.driverStatus === 'ON_DELIVERY' ? '⬆ Delivering' :
                                                    '○ Offline'}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0D1F1B] border-t border-[#00D4AA]/10 flex z-50">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors',
                active ? 'text-[#00D4AA]' : 'text-[#3A6A60] hover:text-[#6A9A90]'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
