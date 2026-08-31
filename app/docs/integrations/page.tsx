import Link from 'next/link'
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react'

const sources = [
  ['Gmail', 'Presión de bandeja agregada; encabezados solo cuando preguntas por correo.'],
  ['Calendar', 'Eventos y densidad de agenda para elegir una ventana realista.'],
  ['Todoist / Notion', 'Tareas activas, vencimientos y ventanas de finalización o edición.'],
  ['Slack', 'Volumen y actividad fuera de horario, sin guardar mensajes.'],
  ['GitHub', 'Ventanas de coding y carga sostenida de repositorios autorizados, sin código.'],
  ['Novo', 'Sesión visible y enfocada dentro de la app; no requiere instalación.'],
]

export const metadata = {
  title: 'Integraciones y dispositivos — Novo',
  description: 'Cómo conectar fuentes de contexto al Twin de Novo.',
}

export default function IntegrationsDocsPage() {
  return (
    <main className="min-h-dvh bg-[#f6f7f3] text-[#101713]">
      <header className="border-b border-[#d9e1d9] bg-[#f6f7f3]/95">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/docs" className="inline-flex items-center gap-2 text-sm font-semibold text-[#208f54] hover:underline"><ArrowLeft className="size-4" /> Documentación</Link>
          <span className="text-xs font-bold tracking-[0.18em] text-[#102018]">NOVO</span>
        </div>
      </header>
      <article className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3fbd76]">Contexto activo</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-[-0.04em] text-[#102018] sm:text-6xl">Conecta tu mundo. El Twin aprende con criterio.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#68736b]">Novo reúne señales autorizadas, conserva solo lo necesario y explica qué cambió en cada recomendación. Una conexión no equivale a acceso ilimitado.</p>

        <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Fuentes disponibles">
          {sources.map(([name, detail]) => <div key={name} className="rounded-2xl border border-[#d9e1d9] bg-white/75 p-5"><p className="font-semibold text-[#24342a]">{name}</p><p className="mt-2 text-sm leading-6 text-[#68736b]">{detail}</p></div>)}
        </section>

        <section className="mt-16 grid gap-12 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#102018]">Primer setup recomendado</h2>
            <ol className="mt-6 space-y-4">{[
              'Abre Ajustes → Conectores y autoriza Calendar + Todoist (o Notion).',
              'Añade Gmail con permiso de solo lectura si la bandeja afecta tus decisiones.',
              'Añade GitHub y conserva únicamente los repositorios que representan tu trabajo actual.',
              'Pulsa Sincronizar todo y revisa Cognitive → Fuentes para comprobar frescura.',
              'Pide el siguiente paso. Novo mostrará las fuentes que realmente aportaron evidencia.',
            ].map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6 text-[#68736b]"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#dff8e8] text-xs font-bold text-[#208f54]">{index + 1}</span>{step}</li>)}</ol>
          </div>
          <aside className="rounded-3xl border border-[#bfe8cd] bg-[#effbf3] p-6"><ShieldCheck className="size-5 text-[#208f54]" /><h2 className="mt-4 text-lg font-bold text-[#24342a]">Diseñado para que puedas corregirlo</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-[#365a43]">{['Señales frescas (<24 h) tienen prioridad.', 'Fuentes obsoletas o revocadas no generan hechos nuevos.', 'Las correcciones del usuario sobreviven al siguiente sync.', 'Puedes pausar aprendizaje o revocar conexiones desde Ajustes.'].map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 size-3.5 shrink-0" />{item}</li>)}</ul></aside>
        </section>

        <section className="mt-16 border-t border-[#d9e1d9] pt-12">
          <h2 className="text-2xl font-bold tracking-tight text-[#102018]">Conectar computadora o teléfono</h2>
          <p className="mt-4 max-w-3xl leading-7 text-[#68736b]">La web ya registra presencia de bajo riesgo: mientras Novo está visible y enfocado, guarda solo inicio y fin de sesión. No captura pantalla, teclas, micrófono, archivos, ubicación ni otras pestañas; sesiones de menos de 30 segundos se descartan.</p>
          <p className="mt-4 max-w-3xl leading-7 text-[#68736b]">El companion nativo para contexto del sistema operativo se habilitará como una conexión separada. El emparejamiento será con código de un solo uso, permisos por capacidad y revocación inmediata. Hasta entonces, no pegues tokens ni instales scripts no firmados: la presencia web y las integraciones OAuth oficiales son el camino soportado.</p>
        </section>

        <footer className="mt-16 border-t border-[#d9e1d9] pt-8 text-sm text-[#68736b]"><Link href="/connectors" className="inline-flex items-center gap-2 font-semibold text-[#208f54] hover:underline">Abrir conectores <ArrowLeft className="size-3.5 rotate-180" /></Link></footer>
      </article>
    </main>
  )
}
