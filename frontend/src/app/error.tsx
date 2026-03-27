'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="text-red-500" size={32} />
      </div>
      <h2 className="font-display font-bold text-2xl text-[#1c1714] mb-2">Something went wrong</h2>
      <p className="text-[#a39083] mb-6 max-w-sm text-sm">An unexpected error occurred. Please try again.</p>
      <button onClick={reset} className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors">
        Try Again
      </button>
    </div>
  );
}
