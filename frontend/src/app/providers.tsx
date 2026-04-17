'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
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
