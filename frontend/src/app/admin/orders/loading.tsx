export default function Loading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-24 rounded-lg bg-[#1e1e28] animate-pulse" />
          <div className="h-3 w-32 mt-2 rounded-lg bg-[#1a1a1e] animate-pulse" />
        </div>
      </div>
      <div className="h-10 rounded-xl bg-[#111116] border border-[#1e1e28] animate-pulse" />
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-20 rounded-full bg-[#1a1a1e] animate-pulse" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-[#111116] border border-[#1e1e28] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
