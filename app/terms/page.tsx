import Link from 'next/link'

export const metadata = {
  title: 'Condiciones del Servicio — Novo',
  description: 'Los términos que rigen el uso de Novo.',
}

export default function TermsPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-black text-white/80">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/landing" className="text-sm text-white/40 hover:text-white/70 transition-colors">
          ← Volver a Novo
        </Link>

        <h1 className="mt-8 text-3xl font-semibold text-white">Condiciones del Servicio</h1>
        <p className="mt-2 text-sm text-white/40">Última actualización: 11 de julio de 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed">
          <section>
            <p>
              Al crear una cuenta o usar Novo (&quot;el Servicio&quot;, disponible en{' '}
              <span className="text-white/60">productivitynovo.vercel.app</span>) aceptas estas
              condiciones. Si no estás de acuerdo, no uses el Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">1. Descripción del servicio</h2>
            <p className="text-white/70">
              Novo es un Sistema Operativo Cognitivo: organiza tareas, rutinas, proyectos y hábitos, y usa
              un asistente de IA para interpretar tu comportamiento real y sugerirte qué hacer en cada
              momento. Las sugerencias del asistente son orientativas — la decisión final siempre es
              tuya.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">2. Tu cuenta</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-white/70">
              <li>Debes tener al menos 13 años para usar Novo.</li>
              <li>Eres responsable de mantener segura tu contraseña y de la actividad en tu cuenta.</li>
              <li>Puedes eliminar tu cuenta en cualquier momento desde Configuración.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">3. Planes y pagos</h2>
            <p className="text-white/70">
              Novo ofrece un plan gratuito con un límite mensual de acciones del asistente de IA, y un
              plan Pro de pago con uso ilimitado. Los pagos se procesan a través de Stripe. Las
              suscripciones se renuevan automáticamente al final de cada período salvo que las canceles
              desde el Portal de Facturación en Configuración — la cancelación aplica al final del
              período ya pagado, sin reembolsos parciales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">4. Uso aceptable</h2>
            <p className="text-white/70">No debes usar Novo para:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-white/70 mt-2">
              <li>Actividades ilegales o que infrinjan derechos de terceros.</li>
              <li>Intentar acceder a cuentas o datos de otros usuarios.</li>
              <li>Interferir con la operación del Servicio (ataques, scraping masivo, ingeniería inversa).</li>
              <li>Usar el asistente de IA para generar contenido dañino, ilegal o abusivo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">5. Contenido generado por IA</h2>
            <p className="text-white/70">
              Las respuestas y sugerencias del asistente son generadas por modelos de lenguaje de terceros
              (Google Gemini, Groq, OpenRouter) y pueden contener errores. No debes depender de ellas para
              decisiones médicas, legales o financieras críticas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">6. Integraciones de terceros</h2>
            <p className="text-white/70">
              Al conectar Google Calendar, Google Drive, Notion, Spotify o Google Fit, autorizas a Novo a
              acceder a los datos de esos servicios según el alcance que apruebes. Puedes revocar el
              acceso en cualquier momento desde Configuración o directamente desde el proveedor.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">7. Propiedad</h2>
            <p className="text-white/70">
              El contenido que creas (tareas, notas, rutinas) es tuyo. Novo y su marca, diseño y código son
              propiedad de sus creadores.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">8. Disponibilidad y cambios</h2>
            <p className="text-white/70">
              El Servicio se ofrece &quot;tal cual&quot;, sin garantía de disponibilidad ininterrumpida.
              Podemos modificar o descontinuar funciones, notificando cambios importantes dentro de la
              aplicación.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">9. Limitación de responsabilidad</h2>
            <p className="text-white/70">
              En la medida permitida por la ley, Novo no será responsable de daños indirectos derivados del
              uso del Servicio, incluidas decisiones tomadas siguiendo sugerencias del asistente de IA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">10. Terminación</h2>
            <p className="text-white/70">
              Podemos suspender cuentas que incumplan estas condiciones. Puedes cerrar tu cuenta en
              cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">11. Contacto</h2>
            <p className="text-white/70">
              Preguntas sobre estas condiciones:{' '}
              <a href="mailto:jordanysjor@gmail.com" className="text-white/90 underline underline-offset-2">
                jordanysjor@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
