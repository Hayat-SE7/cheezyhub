'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function KitchenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="text-red-400" size={32} />
      </div>
      <h2 className="font-bold text-2xl text-[#f2f2f5] mb-2">Something went wrong</h2>
      <p className="text-[#4a4a58] mb-6 max-w-sm text-sm">An unexpected error occurred in the kitchen display.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors">
          Try Again
        </button>
        <Link href="/kitchen" className="px-6 py-3 rounded-xl bg-[#1e1e22] hover:bg-[#2a2a32] text-[#9898a5] font-semibold transition-colors">
          Back to Kitchen
        </Link>
      </div>
    </div>
  );
}
