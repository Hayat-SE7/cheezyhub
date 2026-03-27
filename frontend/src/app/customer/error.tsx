'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-16 text-center">
      <div className="text-7xl mb-6">⚠️</div>
      <h1 className="font-display font-black text-3xl text-[#1c1714] mb-2">Something Went Wrong</h1>
      <p className="text-[#a39083] text-sm font-ui max-w-xs mx-auto mb-8">
        An unexpected error occurred. Please try again or go back to the menu.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-display font-bold text-sm shadow-md shadow-amber-400/25 transition-all"
        >
          Try Again
        </button>
        <Link
          href="/customer"
          className="px-6 py-3 bg-white hover:bg-[#f5f0e8] text-[#1c1714] rounded-2xl font-display font-bold text-sm border border-[#ece6dc] transition-all"
        >
          Back to Menu
        </Link>
      </div>
    </div>
  );
}
