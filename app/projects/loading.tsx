export default function ProjectsLoading() {
  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-foreground/5 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-48 bg-foreground/[0.03] rounded-3xl border border-foreground/5" />
        ))}
      </div>
    </div>
  )
}
