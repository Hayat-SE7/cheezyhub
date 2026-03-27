'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDeliveryStore } from '@/store/deliveryStore';

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useDeliveryStore();

  useEffect(() => {
    if (pathname === '/delivery/login') return;
    if (!isAuthenticated) {
      router.replace('/delivery/login');
      return;
    }
    if (user?.role !== 'delivery' && user?.role !== 'admin') {
      router.replace('/delivery/login');
    }
  }, [isAuthenticated, user, pathname, router]);

  return <div className="dark-ui">{children}</div>;
}
