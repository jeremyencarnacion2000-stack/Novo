export default function LandingLoading() {
  return (
    <main
      className="landing-ambient fixed inset-0 z-[10000] grid h-[100dvh] grid-cols-4 overflow-hidden bg-black"
      aria-label="Preparing Novo"
      role="status"
    >
      <span className="sr-only">Preparing Novo</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-full bg-black" />
      ))}
    </main>
  )
}
