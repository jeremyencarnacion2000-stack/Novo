export default function Loading() {
  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-foreground/5 rounded-2xl" />
      <div className="h-4 w-72 bg-foreground/[0.03] rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-32 bg-foreground/[0.03] rounded-3xl border border-foreground/5" />
        ))}
      </div>
      <div className="h-64 bg-foreground/[0.03] rounded-3xl border border-foreground/5" />
    </div>
  )
}
