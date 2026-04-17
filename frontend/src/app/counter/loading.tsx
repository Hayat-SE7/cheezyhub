export default function Loading() {
  return (
    <div className="min-h-screen bg-[#060607] p-5">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        <div className="space-y-4">
          <div className="h-12 rounded-xl bg-[#111116] border border-[#1e1e28] animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-[#111116] border border-[#1e1e28] animate-pulse" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-[#111116] border border-[#1e1e28] h-[70vh] animate-pulse" />
      </div>
    </div>
  );
}
