export default function Loading() {
  return (
    <div className="p-6 space-y-5">
      <div className="h-6 w-36 rounded-lg bg-[#1e1e28] animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-[#111116] border border-white/6 animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-[#111116] border border-white/6 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-56 rounded-2xl bg-[#111116] border border-white/6 animate-pulse" />
        <div className="h-56 rounded-2xl bg-[#111116] border border-white/6 animate-pulse" />
      </div>
    </div>
  );
}
