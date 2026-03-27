import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl mb-4">🧀</div>
      <h1 className="font-display font-bold text-4xl text-[#1c1714] mb-2">404</h1>
      <p className="text-[#a39083] mb-6">Oops! This page seems to have melted away.</p>
      <Link href="/customer" className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors">
        Back to Menu
      </Link>
    </div>
  );
}
