export default function Loading() {
  return (
    <div className="px-4 pt-5 pb-4 space-y-5">
      <div className="h-24 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
