export default function Loading() {
  return (
    <div className="min-h-screen bg-[#060607] p-5">
      <div className="h-11 w-48 mb-6 rounded-2xl bg-[#111116] animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="space-y-3">
            <div className="h-6 w-24 rounded-lg bg-[#111116] animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-[#0f0f11] border border-[#1e1e28] animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
