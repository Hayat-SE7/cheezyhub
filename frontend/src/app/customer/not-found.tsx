import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-16 text-center">
      <div className="text-7xl mb-6">🔍</div>
      <h1 className="font-display font-black text-3xl text-[#1c1714] mb-2">Page Not Found</h1>
      <p className="text-[#a39083] text-sm font-ui max-w-xs mx-auto mb-8">
        We couldn&apos;t find what you were looking for. It may have moved or no longer exists.
      </p>
      <Link
        href="/customer"
        className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-display font-bold text-sm shadow-md shadow-amber-400/25 transition-all"
      >
        ← Back to Menu
      </Link>
    </div>
  );
}
