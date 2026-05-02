'use client';

import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import toast, { Toaster, useToasterStore } from 'react-hot-toast';

const TOAST_LIMIT = 3;

function ToastLimiter() {
  const { toasts } = useToasterStore();
  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .slice(TOAST_LIMIT)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastLimiter />
      <Toaster
        position="top-center"
        containerStyle={{ top: 12 }}
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
            maxWidth: '420px',
          },
          success: {
            style: { background: '#0c1f0c', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' },
            iconTheme: { primary: '#4ade80', secondary: '#0c1f0c' },
          },
          error: {
            style: { background: '#1f0c0c', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' },
            iconTheme: { primary: '#f87171', secondary: '#1f0c0c' },
          },
        }}
      />
    </QueryClientProvider>
  );
}
