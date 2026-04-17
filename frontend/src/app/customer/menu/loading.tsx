export default function Loading() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pt-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white border border-[#ece6dc] h-32 animate-pulse" />
      ))}
    </div>
  );
}
