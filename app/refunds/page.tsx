import Link from 'next/link'

export const metadata = {
  title: 'Política de reembolsos — Novo',
  description: 'Información sobre cancelaciones y solicitudes de reembolso de Novo Pro.',
}

export default function RefundsPage() {
  return (
    <main className="min-h-dvh bg-black text-white/80">
      <article className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/landing" className="text-sm text-white/50 hover:text-white">← Volver a Novo</Link>
        <h1 className="mt-8 text-3xl font-semibold text-white">Política de reembolsos</h1>
        <p className="mt-2 text-sm text-white/45">Última actualización: 1 de agosto de 2026</p>
        <div className="mt-10 space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-white">Cancelaciones</h2>
            <p className="mt-2">Puedes cancelar Novo Pro cuando quieras desde el portal de facturación. La cancelación evita la siguiente renovación y conserva el acceso hasta el final del periodo pagado.</p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-white">Solicitudes de reembolso</h2>
            <p className="mt-2">Las solicitudes se revisan caso por caso. Escribe a <a className="text-white underline" href="mailto:jordanysjor@gmail.com">jordanysjor@gmail.com</a> desde el correo de tu cuenta e incluye la fecha del cargo y el motivo. No envíes números completos de tarjeta ni credenciales.</p>
          </section>
          <section>
            <h2 className="text-lg font-medium text-white">Proveedor de pagos</h2>
            <p className="mt-2">Los pagos se procesan mediante nuestro proveedor de facturación. Cuando corresponda, el reembolso se emite al mismo método de pago y los plazos dependen de la entidad financiera.</p>
          </section>
        </div>
      </article>
    </main>
  )
}
