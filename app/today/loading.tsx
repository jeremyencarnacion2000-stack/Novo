export default function TodayLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-white/5 rounded-2xl" />
          <div className="h-4 w-48 bg-white/[0.03] rounded-xl" />
        </div>
        <div className="h-16 w-16 bg-white/5 rounded-2xl" />
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full" />
      {[1,2,3].map(i => (
        <div key={i} className="h-40 bg-white/[0.03] rounded-3xl border border-white/5" />
      ))}
    </div>
  )
}
