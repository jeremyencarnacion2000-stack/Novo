import Link from 'next/link'
import { ArrowRight, BookOpen, Check, ChevronRight, ExternalLink, LockKeyhole, Sparkles } from 'lucide-react'

const sections = [
  { id: 'overview', label: 'Visión general' },
  { id: 'connect', label: 'Conectar un cliente' },
  { id: 'permissions', label: 'Permisos y alcance' },
  { id: 'mcp', label: 'Usar MCP' },
  { id: 'security', label: 'Seguridad y revocación' },
  { id: 'troubleshooting', label: 'Solución de problemas' },
]

export const metadata = {
  title: 'Documentación — Novo',
  description: 'Guía para conectar clientes y usar el Cognitive Operating System de Novo.',
}

export default function DocsPage() {
  return (
    <main className="min-h-dvh bg-[#f6f7f3] text-[#101713] selection:bg-[#b7f3d0] selection:text-[#102018]">
      <header className="sticky top-0 z-20 border-b border-[#d9e1d9]/80 bg-[#f6f7f3]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Abrir Novo">
            <span className="grid size-9 place-items-center rounded-xl bg-[#102018] text-sm font-black text-[#b7f3d0]">N</span>
            <span className="text-sm font-bold tracking-[0.18em]">NOVO</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs font-medium text-[#68736b] sm:flex"><LockKeyhole className="size-3.5" /> Documentación pública</span>
            <Link href="/auth/signin" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#102018] px-4 text-xs font-semibold text-[#f6f7f3] transition hover:bg-[#1b2b21]">Abrir Novo <ArrowRight className="size-3.5" /></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 lg:py-16">
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#3fbd76]"><BookOpen className="size-3.5" /> Índice</p>
          <nav aria-label="Índice de documentación" className="space-y-1">
            {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[#68736b] transition hover:bg-white hover:text-[#102018]"><span>{section.label}</span><ChevronRight className="size-3.5 opacity-0 transition group-hover:opacity-100" /></a>)}
          </nav>
          <div className="mt-8 rounded-2xl border border-[#d9e1d9] bg-white/70 p-4 text-xs leading-5 text-[#68736b]">
            <Sparkles className="mb-3 size-4 text-[#3fbd76]" />
            Novo aprende de tus señales, conecta tu contexto y propone el siguiente paso con una explicación clara.
          </div>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <div className="mb-14 border-b border-[#d9e1d9] pb-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3fbd76]">Novo developer & user docs</p>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-[#102018] sm:text-6xl">Una capa cognitiva para tu trabajo real.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#68736b]">Conecta tus herramientas a Novo y deja que tu Twin convierta actividad, objetivos y señales en una decisión útil para este momento.</p>
          </div>

          <section id="overview" className="scroll-mt-28 pb-14">
            <h2 className="text-2xl font-bold tracking-tight">Visión general</h2>
            <p className="mt-4 leading-7 text-[#68736b]">Novo es un Cognitive Operating System. No sustituye tus herramientas: las entiende juntas. El Twin mantiene un modelo vivo de tus objetivos, ritmo, energía, tareas y patrones para ayudarte a decidir qué importa ahora.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">{['Contexto unificado', 'Inferencia explicable', 'Siguiente paso'].map((item) => <div key={item} className="rounded-2xl border border-[#d9e1d9] bg-white/75 p-4 text-sm font-semibold text-[#24342a]">{item}</div>)}</div>
          </section>

          <section id="connect" className="scroll-mt-28 border-t border-[#d9e1d9] py-14">
            <h2 className="text-2xl font-bold tracking-tight">Conectar un cliente</h2>
            <p className="mt-4 leading-7 text-[#68736b]">Las plataformas compatibles usan OAuth 2.1 con PKCE. El flujo siempre ocurre en una página independiente de Novo para que puedas revisar la cuenta, el destino y los permisos antes de aceptar.</p>
            <ol className="mt-6 space-y-3">{['El cliente inicia la conexión y abre la página de autorización de Novo.', 'Si no tienes sesión, Novo te lleva al login y vuelve a la solicitud original.', 'Revisa los permisos y pulsa Autorizar conexión.', 'Novo confirma el acceso y devuelve el navegador al callback del cliente.'].map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6 text-[#68736b]"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#dff8e8] text-xs font-bold text-[#208f54]">{index + 1}</span>{step}</li>)}</ol>
          </section>

          <section id="permissions" className="scroll-mt-28 border-t border-[#d9e1d9] py-14">
            <h2 className="text-2xl font-bold tracking-tight">Permisos y alcance</h2>
            <p className="mt-4 leading-7 text-[#68736b]">Cada cliente recibe únicamente los scopes solicitados. Novo no comparte tu contraseña ni expone tokens de otros proveedores.</p>
            <ul className="mt-6 space-y-3 text-sm text-[#68736b]">{['Leer el contexto necesario para responder.', 'Consultar tareas, objetivos y señales autorizadas.', 'Ejecutar acciones solo cuando el cliente y Novo las permitan.', 'Revocar una conexión desde la configuración de Novo.'].map((item) => <li key={item} className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-[#2caf68]" />{item}</li>)}</ul>
          </section>

          <section id="mcp" className="scroll-mt-28 border-t border-[#d9e1d9] py-14">
            <h2 className="text-2xl font-bold tracking-tight">Usar MCP</h2>
            <p className="mt-4 leading-7 text-[#68736b]">Una vez autorizado, el cliente MCP puede descubrir las herramientas de Novo en el endpoint configurado por su integración. La sesión usa tokens de acceso renovables y queda ligada a tu cuenta de Novo.</p>
            <div className="mt-6 rounded-2xl bg-[#102018] p-5 font-mono text-xs leading-6 text-[#b7f3d0]">Servidor MCP<br /><span className="text-white/70">https://productivitynovo.vercel.app/api/mcp</span></div>
          </section>

          <section id="security" className="scroll-mt-28 border-t border-[#d9e1d9] py-14">
            <h2 className="text-2xl font-bold tracking-tight">Seguridad y revocación</h2>
            <p className="mt-4 leading-7 text-[#68736b]">El consentimiento usa PKCE, cookies firmadas y validación de ownership. Puedes revocar el acceso desde Ajustes → Conexiones; al hacerlo, los tokens dejan de ser válidos.</p>
          </section>

          <section id="troubleshooting" className="scroll-mt-28 border-t border-[#d9e1d9] py-14">
            <h2 className="text-2xl font-bold tracking-tight">Solución de problemas</h2>
            <div className="mt-5 space-y-5 text-sm leading-6 text-[#68736b]
            "><div><h3 className="font-semibold text-[#24342a]">La página vuelve al login</h3><p className="mt-1">Inicia sesión con la cuenta de Novo que quieres autorizar y vuelve a abrir la conexión desde el cliente.</p></div><div><h3 className="font-semibold text-[#24342a]">El cliente no recibe el callback</h3><p className="mt-1">Comprueba que el callback registrado coincide exactamente con el del cliente. Puedes pulsar “Continuar a la aplicación” en la confirmación.</p></div><div><h3 className="font-semibold text-[#24342a]">¿Necesitas ayuda?</h3><p className="mt-1">Reinicia el flujo OAuth para generar una solicitud nueva; las solicitudes expiradas se cierran automáticamente.</p></div></div>
          </section>

          <footer className="border-t border-[#d9e1d9] pt-8 text-sm text-[#68736b]"><Link href="/" className="inline-flex items-center gap-2 font-semibold text-[#208f54] hover:underline">Volver a Novo <ExternalLink className="size-3.5" /></Link></footer>
        </article>
      </div>
    </main>
  )
}
