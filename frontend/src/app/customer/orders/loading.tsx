export default function Loading() {
  return (
    <div className="pt-5">
      <div className="h-8 w-32 mb-5 rounded-lg bg-[#ece6dc] animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-white border border-[#ece6dc] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
