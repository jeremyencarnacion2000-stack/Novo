import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidad — Novo',
  description: 'Cómo Novo recopila, usa y protege tus datos.',
}

export default function PrivacyPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-black text-white/80">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/landing" className="text-sm text-white/40 hover:text-white/70 transition-colors">
          ← Volver a Novo
        </Link>

        <h1 className="mt-8 text-3xl font-semibold text-white">Política de Privacidad</h1>
        <p className="mt-2 text-sm text-white/40">Última actualización: 11 de julio de 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed">
          <section>
            <p>
              Novo (&quot;Novo&quot;, &quot;nosotros&quot;) opera un Sistema Operativo Cognitivo disponible en{' '}
              <span className="text-white/60">productivitynovo.vercel.app</span>. Esta política explica
              qué información recopilamos, cómo la usamos y qué control tienes sobre ella.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">1. Qué información recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-white/70">
              <li>
                <span className="text-white/90">Cuenta:</span> nombre, correo electrónico y, si inicias
                sesión con Google, tu identificador y foto de perfil de Google.
              </li>
              <li>
                <span className="text-white/90">Contenido que creas en Novo:</span> tareas, rutinas,
                proyectos, notas, hábitos, calificaciones escolares, entradas de calendario y
                conversaciones con el asistente de IA.
              </li>
              <li>
                <span className="text-white/90">Señales de comportamiento:</span> qué módulos usas, cuándo
                completas tareas o sesiones de foco, y patrones de uso — esto alimenta el &quot;Gemelo
                Cognitivo&quot;, el modelo que Novo construye de tu energía y atención para sugerirte qué
                hacer en cada momento.
              </li>
              <li>
                <span className="text-white/90">Datos de integraciones que conectes tú mismo:</span>{' '}
                Google Calendar, Google Drive, Notion, Spotify o Google Fit — solo accedemos a lo
                estrictamente necesario para la función que activas, y solo si das tu consentimiento
                explícito al conectar cada servicio.
              </li>
              <li>
                <span className="text-white/90">Datos de pago:</span> si te suscribes a Novo Pro, Stripe
                procesa el pago directamente — Novo nunca almacena tu número de tarjeta.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">2. Cómo usamos tu información</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-white/70">
              <li>Para operar Novo: guardar y sincronizar tus tareas, rutinas y demás contenido.</li>
              <li>
                Para entrenar tu Gemelo Cognitivo — un modelo privado, exclusivo de tu cuenta, que no se
                comparte con otros usuarios ni se usa para entrenar modelos de terceros.
              </li>
              <li>
                Para generar respuestas del asistente de IA: los mensajes que le envías se procesan a
                través de proveedores de IA de terceros (Google Gemini, Groq, OpenRouter) únicamente para
                generar la respuesta — no se usan para publicidad.
              </li>
              <li>Para procesar pagos y gestionar tu suscripción, a través de Stripe.</li>
              <li>Para dar soporte cuando nos contactas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">3. Con quién compartimos datos</h2>
            <p className="text-white/70">
              No vendemos tus datos. Los compartimos únicamente con los proveedores necesarios para
              operar el servicio:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-white/70 mt-2">
              <li>Neon (Postgres) y Vercel — alojamiento de la base de datos y la aplicación.</li>
              <li>Google, Groq y OpenRouter — procesamiento de solicitudes al asistente de IA.</li>
              <li>Stripe — procesamiento de pagos.</li>
              <li>
                Google Calendar, Google Drive, Notion, Spotify, Google Fit — solo si tú conectas
                explícitamente esa integración desde Configuración.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">4. Tus derechos</h2>
            <p className="text-white/70">
              Puedes exportar o eliminar tu cuenta y todos tus datos en cualquier momento desde
              Configuración, o escribiéndonos. Puedes desconectar cualquier integración
              (Google/Notion/Spotify) cuando quieras sin perder acceso al resto de Novo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">5. Seguridad</h2>
            <p className="text-white/70">
              Las contraseñas se almacenan con hash, las conexiones usan HTTPS, y los tokens de acceso a
              integraciones de terceros se guardan cifrados en nuestra base de datos y nunca se exponen
              al navegador.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">6. Menores de edad</h2>
            <p className="text-white/70">
              Novo no está dirigido a menores de 13 años. Si eres padre/madre y crees que un menor nos ha
              proporcionado datos, contáctanos para eliminarlos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">7. Cambios a esta política</h2>
            <p className="text-white/70">
              Si hacemos cambios importantes, lo notificaremos dentro de la aplicación antes de que entren
              en vigor.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-2">8. Contacto</h2>
            <p className="text-white/70">
              Para cualquier pregunta sobre privacidad o para ejercer tus derechos, escribe a{' '}
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
