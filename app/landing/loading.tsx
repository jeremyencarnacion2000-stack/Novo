export default function LandingLoading() {
  return (
    <main className="landing-ambient min-h-screen overflow-hidden bg-[#070908] px-6 py-4 text-[#F5F1E8] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex h-14 items-center justify-between rounded-full border border-white/[0.09] bg-[#080a09]/80 px-5">
          <div className="h-7 w-24 rounded-full bg-white/[0.08]" />
          <div className="h-8 w-24 rounded-full bg-[#F5F1E8]/90" />
        </div>
        <section className="grid min-h-[calc(100dvh-68px)] items-center gap-12 py-14 lg:grid-cols-[.88fr_1.12fr] lg:gap-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-base text-[#ADEBC1] sm:text-lg">La próxima interfaz para la IA no es otro chat.</p>
            <h1 className="mt-5 max-w-2xl text-[clamp(3.5rem,5.7vw,6.25rem)] font-medium leading-[0.9] tracking-[-0.075em] text-[#F5F1E8]">Es contexto compartido.</h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/62">Menos explicación. Más contexto.</p>
          </div>
          <div className="relative aspect-[1.12/1] overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[#07100c] shadow-[0_40px_100px_rgba(0,0,0,0.42)]" aria-hidden="true">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-10"><path d="M50 12 C31 5 14 19 15 40 C5 50 12 72 29 76 C34 91 47 88 50 82 C53 88 66 91 71 76 C88 72 95 50 85 40 C86 19 69 5 50 12 Z" fill="rgba(173,235,193,.025)" stroke="rgba(210,235,218,.2)" strokeWidth=".62" strokeDasharray="1.35 2.15" /><circle cx="50" cy="50" r="4.5" fill="#F4F0E8" opacity=".8" /><circle cx="31" cy="29" r="2.7" fill="#A6D6B5" opacity=".7" /><circle cx="68" cy="28" r="2.5" fill="#83B996" opacity=".7" /></svg>
          </div>
        </section>
      </div>
    </main>
  )
}
