'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useKitchenStore } from '@/store/kitchenStore';

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useKitchenStore();

  useEffect(() => {
    if (pathname === '/kitchen/login') return;
    if (!isAuthenticated) {
      router.replace('/kitchen/login');
      return;
    }
    if (user?.role !== 'staff' && user?.role !== 'admin') {
      router.replace('/kitchen/login');
    }
  }, [isAuthenticated, user, pathname, router]);

  return <div className="dark-ui">{children}</div>;
}
