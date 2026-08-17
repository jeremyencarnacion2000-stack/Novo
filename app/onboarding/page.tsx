'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Brain, ArrowRight, Sparkles, RefreshCw, Check } from 'lucide-react'
import { ConfidenceGauge, TrustBadge } from '@/components/cognitive/primitives'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'
import { useTranslation } from '@/lib/i18n'
import { NovoSpriteLoader } from '@/components/ui/novo-sprite-loader'

interface Message {
  role: 'assistant' | 'user'
  content: string
}

// Base Twin profile used when the analysis endpoint is slow/unreachable. Shared
// by the compilation timeout fallback AND handleFinalize, so finishing
// onboarding ALWAYS initializes the Twin — never a dead "Finalize" button that
// leaves a brand-new user stuck in the /onboarding redirect loop.
const DEFAULT_TWIN_DATA = {
  // A new Twin has no evidence yet. Zero is intentionally rendered as
  // uncalibrated rather than pretending the legacy bootstrap value was a measurement.
  confidenceScore: 0,
  trustLevel: 'initial',
  longTermGoal: '',
  identity: { role: '', focusStyle: '', deepWorkCapacity: 3.5, industry: '' },
  energyCurve: { chronotype: '', peakFocusStart: '', peakFocusEnd: '', typicalSlumpHour: 14 },
  selfDiscoveryText: 'Tu perfil base ha sido creado. El Twin aprenderá de tus patrones reales con el tiempo.',
}

interface DayPlanState {
  tasks: any[]
  event: any | null
  reasoning: string[]
}

const STEPS = [
  {
    id: 'identity',
    question: 'Para comenzar a calibrar tu espacio cognitivo, cuéntame: ¿cuál es tu rol principal actualmente?',
    options: [
      { label: 'Estudiante Universitario', value: 'student' },
      { label: 'Fundador de Startup / CEO', value: 'founder' },
      { label: 'Desarrollador / Ingeniero', value: 'developer' },
      { label: 'Creador de Contenido / Diseñador', value: 'creator' },
      { label: 'Profesional Corporativo', value: 'professional' },
    ],
  },
  {
    id: 'energy',
    question: 'Entendido. Hablemos de tus biorritmos. ¿En qué momento del día sientes que tu mente está al 100% de lucidez?',
    options: [
      { label: 'Mañanas tempranas (Foco matutino)', value: 'morning' },
      { label: 'Tarde / Media tarde', value: 'afternoon' },
      { label: 'Noches / Madrugadas (Búho nocturno)', value: 'night' },
    ],
  },
  {
    id: 'friction',
    question: 'Identificar tus fugas de energía es vital. ¿Qué es lo que más te cuesta o te roba tiempo en tu día a día?',
    options: [
      { label: 'Procrastinar tareas difíciles', value: 'procrastination' },
      { label: 'Alternar constantemente entre múltiples tareas (Context switching)', value: 'context_switching' },
      { label: 'Acepto demasiadas responsabilidades a la vez (Sobrecarga)', value: 'overcommitment' },
      { label: 'Falta de una estructura clara diaria', value: 'lack_of_structure' },
    ],
  },
  {
    id: 'goals',
    question: '¿Cuál es tu principal meta u objetivo para los próximos 12 meses?',
    placeholder: 'Ej: Lanzar mi producto al mercado, aprobar todos mis exámenes con excelencia...',
  },
  {
    id: 'motivation',
    question: 'Por último, cuando las cosas se ponen difíciles o aburridas, ¿qué es lo que te ayuda a seguir adelante?',
    options: [
      { label: 'Ver el progreso visual y tachar objetivos (Logro)', value: 'achievement' },
      { label: 'La urgencia de una fecha límite (Adrenalina)', value: 'urgency' },
      { label: 'Hacer el proceso divertido con recompensas (Gamificación)', value: 'gamification' },
      { label: 'Un ambiente calmado y minimalista (Paz mental)', value: 'minimalist_calm' },
    ],
  },
]

type OnboardingStep = {
  id: string
  question: string
  options?: Array<{ label: string; value: string }>
  placeholder?: string
}
type OnboardingLanguage = 'en' | 'es' | 'fr' | 'de'

type OnboardingCopy = {
  welcome: string
  brandStatus: string
  demoStatus: string
  step: string
  of: string
  signalHelper: string
  goalLabel: string
  answerPlaceholder: string
  continue: string
  compilingTitle: string
  compilingDemoTitle: string
  compilingDescription: string
  compilingDemoDescription: string
  compilationSteps: string[]
  profileTitle: string
  profileAccuracy: string
  profileFocus: string
  profileWindow: string
  profileInsight: string
  profileExplanation: string
  demoExplanation: string
  templateNote: string
  activate: string
  seePlan: string
  planTitle: string
  planSubtitle: string
  generatingPlan: string
  taskReady: string
  eventReady: string
  planNote: string
  enter: string
  focusStyles: Record<string, string>
  questions: Record<string, { question: string; placeholder?: string; options?: Record<string, string> }>
}

const ONBOARDING_COPY: Record<OnboardingLanguage, OnboardingCopy> = {
  en: {
    welcome: 'Welcome to Novo. Let’s prepare a first day that fits the way you work.',
    brandStatus: 'Your first day', demoStatus: 'Demo in progress', step: 'STEP', of: 'OF',
    signalHelper: 'This helps us shape your first day, never limit what you can do.',
    goalLabel: 'Your main goal', answerPlaceholder: 'Write your answer…', continue: 'Continue',
    compilingTitle: 'Preparing your workspace', compilingDemoTitle: 'Replaying 30 days of progress',
    compilingDescription: 'Turning your answers into a calm, useful starting point.', compilingDemoDescription: 'Loading a realistic history for the demo.',
    compilationSteps: ['Reading your focus rhythm', 'Finding a gentler first step', 'Shaping your focus space', 'Creating your starting profile', 'Preparing your first day'],
    profileTitle: 'Your starting point', profileAccuracy: 'LEARNING SIGNAL', profileFocus: 'FOCUS STYLE', profileWindow: 'FOCUS WINDOW', profileInsight: 'WHAT WE NOTICED',
    profileExplanation: 'Novo will refine this over time from your real habits.', demoExplanation: 'This profile reflects 30 days of simulated activity.',
    templateNote: 'You shaped this with five answers — it is a starting point, not a generic template.', activate: 'Activate my Twin', seePlan: 'See my first-day plan',
    planTitle: 'Your first day is ready', planSubtitle: 'A small, realistic start based on your goal and energy.', generatingPlan: 'Creating your first-day plan…',
    taskReady: 'Ready for you', eventReady: 'Reserved in your calendar', planNote: 'It is already in your list. You only need to begin.', enter: 'Enter Novo',
    focusStyles: { deep_builder: 'Deep builder', reactive_communicator: 'Responsive communicator', frantic_juggler: 'Busy juggler', consistent_planner: 'Steady planner' },
    questions: {
      identity: { question: 'What best describes your main role right now?', options: { student: 'University student', founder: 'Startup founder / CEO', developer: 'Developer / engineer', creator: 'Creator / designer', professional: 'Corporate professional' } },
      energy: { question: 'When does your mind feel clearest?', options: { morning: 'Early morning', afternoon: 'Afternoon', night: 'Evening or late night' } },
      friction: { question: 'What most often gets in the way of your day?', options: { procrastination: 'Starting difficult tasks', context_switching: 'Switching between too many tasks', overcommitment: 'Taking on too much at once', lack_of_structure: 'Not having a clear daily structure' } },
      goals: { question: 'What is your main goal for the next 12 months?', placeholder: 'For example: launch my product or finish my degree…' },
      motivation: { question: 'When things get difficult, what helps you keep going?', options: { achievement: 'Seeing progress and checking things off', urgency: 'A clear deadline', gamification: 'Making the process rewarding', minimalist_calm: 'A calm, simple environment' } },
    },
  },
  es: {
    welcome: 'Bienvenido a Novo. Vamos a preparar un primer día que se adapte a tu forma de trabajar.',
    brandStatus: 'Tu primer día', demoStatus: 'Demo en curso', step: 'PASO', of: 'DE',
    signalHelper: 'Usaremos esta señal para adaptar tu primer día, no para limitarte.',
    goalLabel: 'Tu objetivo principal', answerPlaceholder: 'Escribe tu respuesta…', continue: 'Continuar',
    compilingTitle: 'Preparando tu espacio', compilingDemoTitle: 'Recreando 30 días de progreso',
    compilingDescription: 'Convertimos tus respuestas en un comienzo sereno y útil.', compilingDemoDescription: 'Cargando un historial realista para la demo.',
    compilationSteps: ['Leyendo tu ritmo de foco', 'Encontrando un primer paso amable', 'Dando forma a tu espacio de foco', 'Creando tu perfil inicial', 'Preparando tu primer día'],
    profileTitle: 'Tu punto de partida', profileAccuracy: 'SEÑAL DE APRENDIZAJE', profileFocus: 'ESTILO DE FOCO', profileWindow: 'VENTANA DE FOCO', profileInsight: 'LO QUE NOTAMOS',
    profileExplanation: 'Novo irá afinando esto con tus hábitos reales.', demoExplanation: 'Este perfil refleja 30 días de actividad simulada.',
    templateNote: 'Lo construiste con cinco respuestas: es un punto de partida, no una plantilla genérica.', activate: 'Activar mi Gemelo', seePlan: 'Ver mi plan del primer día',
    planTitle: 'Tu primer día está listo', planSubtitle: 'Un comienzo pequeño y realista según tu meta y energía.', generatingPlan: 'Creando tu plan del primer día…',
    taskReady: 'Listo para ti', eventReady: 'Reservado en tu calendario', planNote: 'Ya está en tu lista. Solo necesitas comenzar.', enter: 'Entrar a Novo',
    focusStyles: { deep_builder: 'Constructor profundo', reactive_communicator: 'Comunicador reactivo', frantic_juggler: 'Malabarista ocupado', consistent_planner: 'Planificador constante' },
    questions: {
      identity: { question: '¿Cuál describe mejor tu rol principal hoy?', options: { student: 'Estudiante universitario', founder: 'Fundador de startup / CEO', developer: 'Desarrollador / ingeniero', creator: 'Creador / diseñador', professional: 'Profesional corporativo' } },
      energy: { question: '¿Cuándo sientes la mente más clara?', options: { morning: 'Mañana temprano', afternoon: 'Tarde', night: 'Noche o madrugada' } },
      friction: { question: '¿Qué se interpone más a menudo en tu día?', options: { procrastination: 'Empezar tareas difíciles', context_switching: 'Cambiar entre demasiadas tareas', overcommitment: 'Asumir demasiado a la vez', lack_of_structure: 'No tener una estructura diaria clara' } },
      goals: { question: '¿Cuál es tu principal meta para los próximos 12 meses?', placeholder: 'Ej.: lanzar mi producto o terminar mi carrera…' },
      motivation: { question: 'Cuando las cosas se complican, ¿qué te ayuda a seguir?', options: { achievement: 'Ver progreso y completar objetivos', urgency: 'Una fecha límite clara', gamification: 'Hacer el proceso gratificante', minimalist_calm: 'Un ambiente simple y tranquilo' } },
    },
  },
  fr: {
    welcome: 'Bienvenue dans Novo. Préparons une première journée adaptée à votre façon de travailler.',
    brandStatus: 'Votre première journée', demoStatus: 'Démo en cours', step: 'ÉTAPE', of: 'SUR',
    signalHelper: 'Ce signal nous aide à adapter votre première journée, sans vous limiter.',
    goalLabel: 'Votre objectif principal', answerPlaceholder: 'Écrivez votre réponse…', continue: 'Continuer',
    compilingTitle: 'Préparation de votre espace', compilingDemoTitle: 'Simulation de 30 jours de progrès',
    compilingDescription: 'Nous transformons vos réponses en un point de départ calme et utile.', compilingDemoDescription: 'Chargement d’un historique réaliste pour la démo.',
    compilationSteps: ['Lecture de votre rythme de concentration', 'Recherche d’un premier pas plus doux', 'Création de votre espace de concentration', 'Création de votre profil initial', 'Préparation de votre première journée'],
    profileTitle: 'Votre point de départ', profileAccuracy: 'SIGNAL D’APPRENTISSAGE', profileFocus: 'STYLE DE CONCENTRATION', profileWindow: 'PLAGE DE CONCENTRATION', profileInsight: 'CE QUE NOUS AVONS REMARQUÉ',
    profileExplanation: 'Novo affinera cela à partir de vos habitudes réelles.', demoExplanation: 'Ce profil reflète 30 jours d’activité simulée.',
    templateNote: 'Vous avez créé ceci avec cinq réponses : ce n’est pas un modèle générique.', activate: 'Activer mon Jumeau', seePlan: 'Voir mon plan du premier jour',
    planTitle: 'Votre première journée est prête', planSubtitle: 'Un départ simple et réaliste selon votre objectif et votre énergie.', generatingPlan: 'Création de votre plan du premier jour…',
    taskReady: 'Prêt pour vous', eventReady: 'Réservé dans votre calendrier', planNote: 'Tout est déjà dans votre liste. Il ne reste qu’à commencer.', enter: 'Entrer dans Novo',
    focusStyles: { deep_builder: 'Bâtisseur concentré', reactive_communicator: 'Communicant réactif', frantic_juggler: 'Jongleur très sollicité', consistent_planner: 'Planificateur régulier' },
    questions: {
      identity: { question: 'Quel est votre rôle principal actuellement ?', options: { student: 'Étudiant universitaire', founder: 'Fondateur de startup / CEO', developer: 'Développeur / ingénieur', creator: 'Créateur / designer', professional: 'Professionnel en entreprise' } },
      energy: { question: 'À quel moment votre esprit est-il le plus clair ?', options: { morning: 'Tôt le matin', afternoon: 'L’après-midi', night: 'Le soir ou tard la nuit' } },
      friction: { question: 'Qu’est-ce qui freine le plus souvent votre journée ?', options: { procrastination: 'Commencer les tâches difficiles', context_switching: 'Passer entre trop de tâches', overcommitment: 'En faire trop à la fois', lack_of_structure: 'Manquer d’une structure claire' } },
      goals: { question: 'Quel est votre objectif principal pour les 12 prochains mois ?', placeholder: 'Ex. : lancer mon produit ou obtenir mon diplôme…' },
      motivation: { question: 'Quand les choses deviennent difficiles, qu’est-ce qui vous aide à continuer ?', options: { achievement: 'Voir les progrès accomplis', urgency: 'Une échéance claire', gamification: 'Rendre le processus gratifiant', minimalist_calm: 'Un environnement calme et simple' } },
    },
  },
  de: {
    welcome: 'Willkommen bei Novo. Wir bereiten einen ersten Tag vor, der zu deiner Arbeitsweise passt.',
    brandStatus: 'Dein erster Tag', demoStatus: 'Demo läuft', step: 'SCHRITT', of: 'VON',
    signalHelper: 'Dieses Signal hilft uns, deinen ersten Tag anzupassen — es begrenzt dich nicht.',
    goalLabel: 'Dein wichtigstes Ziel', answerPlaceholder: 'Schreibe deine Antwort…', continue: 'Weiter',
    compilingTitle: 'Dein Bereich wird vorbereitet', compilingDemoTitle: '30 Tage Fortschritt werden nachgebildet',
    compilingDescription: 'Wir machen aus deinen Antworten einen ruhigen, hilfreichen Start.', compilingDemoDescription: 'Für die Demo wird ein realistischer Verlauf geladen.',
    compilationSteps: ['Deinen Fokus-Rhythmus lesen', 'Einen leichteren ersten Schritt finden', 'Deinen Fokusbereich gestalten', 'Dein Startprofil erstellen', 'Deinen ersten Tag vorbereiten'],
    profileTitle: 'Dein Ausgangspunkt', profileAccuracy: 'LERNSIGNAL', profileFocus: 'FOKUSSTIL', profileWindow: 'FOKUSZEIT', profileInsight: 'WAS WIR BEMERKT HABEN',
    profileExplanation: 'Novo verfeinert dies mit deinen echten Gewohnheiten.', demoExplanation: 'Dieses Profil zeigt 30 Tage simulierte Aktivität.',
    templateNote: 'Du hast dies mit fünf Antworten gestaltet — kein allgemeines Template.', activate: 'Meinen Zwilling aktivieren', seePlan: 'Meinen ersten Tagesplan ansehen',
    planTitle: 'Dein erster Tag ist bereit', planSubtitle: 'Ein kleiner, realistischer Start für dein Ziel und deine Energie.', generatingPlan: 'Dein Plan für den ersten Tag wird erstellt…',
    taskReady: 'Für dich bereit', eventReady: 'In deinem Kalender reserviert', planNote: 'Alles ist bereits in deiner Liste. Du musst nur anfangen.', enter: 'Novo öffnen',
    focusStyles: { deep_builder: 'Tiefenarbeiter', reactive_communicator: 'Reaktiver Kommunikator', frantic_juggler: 'Vielbeschäftigter Jongleur', consistent_planner: 'Beständiger Planer' },
    questions: {
      identity: { question: 'Was beschreibt deine aktuelle Hauptrolle am besten?', options: { student: 'Universitätsstudent', founder: 'Startup-Gründer / CEO', developer: 'Entwickler / Ingenieur', creator: 'Kreativer / Designer', professional: 'Unternehmensprofi' } },
      energy: { question: 'Wann ist dein Kopf am klarsten?', options: { morning: 'Frühmorgens', afternoon: 'Am Nachmittag', night: 'Abends oder spät in der Nacht' } },
      friction: { question: 'Was steht deinem Tag am häufigsten im Weg?', options: { procrastination: 'Schwierige Aufgaben beginnen', context_switching: 'Zwischen zu vielen Aufgaben wechseln', overcommitment: 'Zu viel auf einmal übernehmen', lack_of_structure: 'Keine klare Tagesstruktur haben' } },
      goals: { question: 'Was ist dein wichtigstes Ziel für die nächsten 12 Monate?', placeholder: 'Zum Beispiel: mein Produkt starten oder mein Studium abschließen…' },
      motivation: { question: 'Was hilft dir weiterzumachen, wenn es schwierig wird?', options: { achievement: 'Fortschritt sehen und Dinge abhaken', urgency: 'Eine klare Deadline', gamification: 'Den Prozess lohnend machen', minimalist_calm: 'Eine ruhige, einfache Umgebung' } },
    },
  },
}

function getLocalizedStep(step: OnboardingStep, language: OnboardingLanguage): OnboardingStep {
  const localized = ONBOARDING_COPY[language].questions[step.id]
  return {
    ...step,
    question: localized?.question ?? step.question,
    placeholder: localized?.placeholder ?? step.placeholder,
    options: step.options?.map((option) => ({
      ...option,
      label: localized?.options?.[option.value] ?? option.label,
    })),
  }
}

function OnboardingQuestionCard({
  step,
  stepIndex,
  visualSrc,
  copy,
  onAnswer,
  inputValue,
  setInputValue,
  onSubmit,
}: {
  step: OnboardingStep
  stepIndex: number
  visualSrc: string
  copy: OnboardingCopy
  onAnswer: (label: string, value: string) => void
  inputValue: string
  setInputValue: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}) {
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
      className="w-full max-w-[34rem]"
    >
      <div className="mb-7 flex items-center justify-between text-[11px] font-semibold tracking-[0.08em] text-white/55">
        <span>{copy.step} {stepIndex + 1} {copy.of} {STEPS.length}</span>
        <span className="text-white/75">{Math.round(progress)}%</span>
      </div>
      <div className="mb-8 h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className="h-full rounded-full bg-[#B7F3D0]"
          initial={false}
          animate={{ scaleX: progress / 100 }}
          style={{ transformOrigin: 'left' }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        />
      </div>

      <div className="rounded-[2rem] border border-white/[0.1] bg-[#101114]/94 p-5 shadow-[0_24px_80px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] sm:p-7">
        <div className="relative mb-6 h-28 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 sm:h-32">
          <Image src={visualSrc} alt="" fill className="object-cover object-[center_62%]" sizes="(max-width: 640px) 90vw, 34rem" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090b09]/60 via-transparent to-transparent" />
        </div>
        <div className="mb-6 flex size-10 items-center justify-center rounded-2xl border border-[#B7F3D0]/20 bg-[#B7F3D0]/10 text-[#B7F3D0]">
          <Sparkles className="size-4" strokeWidth={1.5} />
        </div>
        <h1 className="max-w-md text-[1.65rem] font-medium leading-[1.15] tracking-[-0.04em] text-white sm:text-[2rem]">
          {step.question}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          {copy.signalHelper}
        </p>

        {step.options ? (
          <div className="mt-7 grid gap-2">
            {step.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onAnswer(option.label, option.value)}
                className="group flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-black/15 px-4 text-left text-sm text-white/80 transition-[background,border-color,transform] duration-150 hover:border-[#B7F3D0]/35 hover:bg-white/[0.075] active:scale-[0.98]"
              >
                <span>{option.label}</span>
                <ArrowRight className="size-4 text-white/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#B7F3D0]" strokeWidth={1.5} />
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-7">
            <label className="sr-only" htmlFor="onboarding-goal">{copy.goalLabel}</label>
            <textarea
              id="onboarding-goal"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={step.placeholder ?? copy.answerPlaceholder}
              className="min-h-32 w-full resize-none rounded-2xl border border-white/[0.1] bg-black/15 p-4 text-sm leading-relaxed text-white outline-none transition-[border-color,background,box-shadow] placeholder:text-white/35 focus:border-[#B7F3D0]/45 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#B7F3D0]/15"
              autoFocus
            />
            <button type="submit" className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-black transition-[background,transform] duration-150 hover:bg-white/90 active:scale-[0.98]">
              {copy.continue} <ArrowRight className="size-4" strokeWidth={1.6} />
            </button>
          </form>
        )}
      </div>
    </motion.div>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemoMode = searchParams?.get('demo') === 'twin'
  const hasProIntent = searchParams?.get('intent') === 'pro'
  const { twin, initializeTwin, isLoading: isTwinLoading } = useCognitiveTwin()
  const { data: session, status: sessionStatus } = useSession()
  const { language } = useTranslation()
  const onboardingLanguage: OnboardingLanguage = language in ONBOARDING_COPY
    ? language as OnboardingLanguage
    : 'en'
  const copy = ONBOARDING_COPY[onboardingLanguage]
  const finalizationCopy: Record<OnboardingLanguage, { saving: string; error: string }> = {
    en: { saving: 'Saving your setup…', error: 'We could not save your setup. Check your connection and try again.' },
    es: { saving: 'Guardando tu configuración…', error: 'No pudimos guardar tu configuración. Revisa tu conexión e inténtalo de nuevo.' },
    fr: { saving: 'Enregistrement de votre configuration…', error: 'Votre configuration n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez.' },
    de: { saving: 'Deine Einrichtung wird gespeichert…', error: 'Deine Einrichtung konnte nicht gespeichert werden. Prüfe deine Verbindung und versuche es erneut.' },
  }

  const [currentStep, setCurrentStep] = useState(0)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: copy.welcome },
    { role: 'assistant', content: getLocalizedStep(STEPS[0], onboardingLanguage).question },
  ])
  const [inputVal, setInputVal] = useState('')
  const [stage, setStage] = useState<'interview' | 'compilation' | 'self_discovery' | 'day1_plan'>('interview')

  // Compilation states
  const [compileStep, setCompileStep] = useState(0)
  const [twinData, setTwinData] = useState<any>(null)

  // Day 1 plan states — populated by generateAndExecuteDayPlan via
  // /api/onboarding/day-plan, revealed one item at a time on the day1_plan stage
  const [dayPlan, setDayPlan] = useState<DayPlanState | null>(null)
  const [planRevealStep, setPlanRevealStep] = useState(0)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const demoStartedRef = useRef(false)

  // /onboarding is intentionally public for acquisition and review, but an
  // authenticated user whose persisted Twin is already initialized must never
  // restart Day 1 via a stale callback URL, bookmark, or browser back action.
  useEffect(() => {
    if (sessionStatus === 'authenticated' && !isTwinLoading && twin.isInitialized && !isDemoMode) {
      router.replace('/today')
    }
  }, [isDemoMode, isTwinLoading, router, sessionStatus, twin.isInitialized])

  // Settings hydrate after the first client render. Keep the analysis
  // transcript aligned with the visible language until the user answers.
  useEffect(() => {
    setMessages((previous) => previous.some((message) => message.role === 'user')
      ? previous
      : [
          { role: 'assistant', content: copy.welcome },
          { role: 'assistant', content: getLocalizedStep(STEPS[0], onboardingLanguage).question },
        ])
  }, [copy.welcome, onboardingLanguage])

  // Funnel instrumentation is server-owned and intentionally contains no
  // onboarding answers or prompt content. The ref prevents duplicate events
  // caused by React Strict Mode or a language hydration pass.
  const onboardingStartedRef = useRef(false)
  useEffect(() => {
    if (!session?.user?.id || twin.isInitialized || onboardingStartedRef.current) return
    onboardingStartedRef.current = true
    void fetch('/api/onboarding/start', { method: 'POST' }).catch(() => undefined)
  }, [session?.user?.id, twin.isInitialized])
  // Trigger Demo flow on mount if demo=twin parameter is present
  useEffect(() => {
    if (isDemoMode && !demoStartedRef.current) {
      demoStartedRef.current = true
      triggerDemoSeeding()
    }
  }, [isDemoMode])

  const triggerDemoSeeding = async () => {
    setStage('compilation')
    setCompileStep(0)

    const compileTimings = [200, 400, 600, 800, 1000]
    compileTimings.forEach((time, index) => {
      setTimeout(() => setCompileStep(index + 1), time)
    })

    try {
      const response = await fetch('/api/cognitive-twin/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) throw new Error(`Demo twin request failed: ${response.status}`)
      const data = await response.json()
      if (data.success && data.twin) {
        setTwinData(data.twin)
      } else {
        setTwinData(DEFAULT_TWIN_DATA)
      }
    } catch (e) {
      console.error('Failed to seed demo twin data:', e)
      setTwinData(DEFAULT_TWIN_DATA)
    }
  }

  // Dynamic next step trigger
  const handleAnswer = (answerText: string, value: string) => {
    // Add User response
    const answerForAnalysis = value === answerText ? answerText : `${answerText} [selection:${value}]`
    setMessages(prev => [...prev, { role: 'user', content: answerForAnalysis }])
    
    setTimeout(() => {
      if (currentStep < STEPS.length - 1) {
        const next = currentStep + 1
        setCurrentStep(next)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: getLocalizedStep(STEPS[next], onboardingLanguage).question,
        }])
      } else {
        // Conversation finished -> Trigger Compilation
        triggerCompilation()
      }
    }, 600)
  }

  const handleCustomInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputVal.trim()) return
    const val = inputVal
    setInputVal('')
    handleAnswer(val, val)
  }

  // Generates + actually creates the user's Day 1 plan (2-3 tasks + a deep-work
  // calendar block) via /api/onboarding/day-plan so /today isn't empty on first
  // login. Fires in the background — the day1_plan stage shows a loading state
  // if it hasn't resolved yet by the time the user gets there.
  const triggerDayPlan = async (twin: any) => {
    if (!session?.user?.id) return
    try {
      const res = await fetch('/api/onboarding/day-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twin }),
      })
      const data = await res.json()
      if (!data.error) setDayPlan(data)
    } catch (e) {
      console.error('Failed to generate day 1 plan:', e)
    }
  }

  const triggerCompilation = async () => {
    setStage('compilation')
    setCompileStep(0)

    const compileTimings = [800, 1600, 2400, 3200, 4200]
    compileTimings.forEach((time, index) => {
      setTimeout(() => setCompileStep(index + 1), time)
    })

    // clearTimeout doesn't help once the timer has already fired: if
    // /api/onboarding/analyze takes >=8s, the fallback branch below AND the
    // success branch after `await fetch` both ran, each calling
    // triggerDayPlan → POST /api/onboarding/day-plan, which unconditionally
    // creates real tasks + a calendar event with no dedup guard server-side
    // — a new user got their Day 1 plan created twice. One local flag shared
    // by both closures (this function runs once per onboarding session)
    // makes "first one wins" instead of "both can win".
    let dayPlanStarted = false
    const settleTwin = (data: any) => {
      if (dayPlanStarted) return
      dayPlanStarted = true
      setTwinData(data)
      triggerDayPlan(data)
    }

    // Call analysis endpoint with conversation history
    // 8-second timeout — fallback to default twin values to avoid infinite loading
    const analyzeTimeout = setTimeout(() => {
      settleTwin(DEFAULT_TWIN_DATA)
    }, 8000)

    try {
      const response = await fetch('/api/onboarding/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, language })
      })
      if (!response.ok) throw new Error(`Onboarding analysis failed: ${response.status}`)
      const data = await response.json()
      clearTimeout(analyzeTimeout)
      settleTwin(data)
    } catch (e) {
      console.error(e)
      clearTimeout(analyzeTimeout)
      settleTwin(DEFAULT_TWIN_DATA)
    }
  }

  useEffect(() => {
    if (stage !== 'compilation' || compileStep < copy.compilationSteps.length || !twinData) return
    const transitionTimer = setTimeout(() => setStage('self_discovery'), isDemoMode ? 400 : 700)
    return () => clearTimeout(transitionTimer)
  }, [compileStep, copy.compilationSteps.length, isDemoMode, stage, twinData])

  // Reveal each created task/event one at a time on the day1_plan stage,
  // reusing the same terminal-log timing pattern as the compilation stage.
  useEffect(() => {
    if (stage !== 'day1_plan' || !dayPlan) return
    const itemCount = dayPlan.tasks.length + (dayPlan.event ? 1 : 0)
    setPlanRevealStep(0)
    const timers = Array.from({ length: itemCount }, (_, i) =>
      setTimeout(() => setPlanRevealStep(i + 1), (i + 1) * 500)
    )
    return () => timers.forEach(clearTimeout)
  }, [stage, dayPlan])

  const handleFinalize = async () => {
    if (isFinalizing) return
    setIsFinalizing(true)
    setFinalizeError(null)
    // Always initialize — fall back to the base profile if the analysis hasn't
    // resolved yet, so the button is never inert and no new user gets stranded.
    const data = twinData ?? DEFAULT_TWIN_DATA
    const persisted = await initializeTwin({
      ...data,
      isInitialized: true,
      confidenceScore: data.confidenceScore ?? 0,
      trustLevel: data.trustLevel ?? 'initial'
    })
    if (!persisted) {
      setFinalizeError(finalizationCopy[onboardingLanguage].error)
      setIsFinalizing(false)
      return
    }
    // A visitor who explicitly chose Pro on the landing sees the offer only
    // after Novo has demonstrated value through the personalized first day.
    // Everyone else lands directly in that first day without a sales detour.
    const purchaseIntent = hasProIntent || localStorage.getItem('novo:purchase-intent') === 'pro'
    if (purchaseIntent) {
      localStorage.removeItem('novo:purchase-intent')
      router.push('/settings?tab=billing&source=landing-intent')
      return
    }
    router.push('/today')
  }

  const activeStep = STEPS[currentStep]
  const displayedActiveStep = activeStep ? getLocalizedStep(activeStep, onboardingLanguage) : null

  if (sessionStatus === 'authenticated' && !isTwinLoading && twin.isInitialized && !isDemoMode) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#070709] text-white">
        <NovoSpriteLoader size="md" label="Novo" className="text-white" />
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-[#070709] font-sans text-white"
      style={{ backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(183,243,208,0.04), transparent 38%), radial-gradient(circle at 100% 100%, rgba(216,198,160,0.035), transparent 40%)' }}
    >

      {/* HEADER */}
      <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#070709]/92 px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#B7F3D0]/10 border border-[#B7F3D0]/25 flex items-center justify-center">
            <Brain className="w-4 h-4 text-[#B7F3D0]" />
          </div>
          <span className="text-xs font-black tracking-[0.25em] uppercase text-white/90">NOVO</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            {isDemoMode ? copy.demoStatus : copy.brandStatus}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#B7F3D0] animate-pulse" />
        </div>
      </div>

      {/* STAGE CONTAINER */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          
          {/* STAGE 1: NEURAL INTERVIEW */}
          {stage === 'interview' && displayedActiveStep && (
            <div className="relative z-10 flex min-h-0 flex-1 items-start justify-center overflow-y-auto overscroll-contain px-5 py-8 sm:items-center sm:px-8">
              <AnimatePresence mode="wait">
                <OnboardingQuestionCard
                  step={displayedActiveStep}
                  stepIndex={currentStep}
                  visualSrc={currentStep < 2 ? '/onboarding-attention.png' : currentStep < 4 ? '/onboarding-rhythm.png' : '/onboarding-direction.png'}
                  copy={copy}
                  onAnswer={(label, value) => {
                    handleAnswer(label, value)
                  }}
                  inputValue={inputVal}
                  setInputValue={setInputVal}
                  onSubmit={handleCustomInputSubmit}
                />
              </AnimatePresence>
            </div>
          )}

          {/* STAGE 2: TWIN COMPILATION ANIMATION */}
          {stage === 'compilation' && (
            <motion.div
              key="compilation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col items-center overflow-y-auto overscroll-contain px-6 py-8 text-center sm:justify-center"
            >
              <div className="relative mb-7 flex min-h-48 w-full shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[radial-gradient(circle_at_50%_50%,rgba(183,243,208,0.09),transparent_58%),rgba(255,255,255,0.018)]">
                <div className="novo-loader-orbit" aria-hidden />
                <NovoSpriteLoader size="lg" className="relative z-10" />
              </div>

              <h2 className="text-[1.65rem] font-medium tracking-[-0.04em] text-white mb-2">
                {isDemoMode ? copy.compilingDemoTitle : copy.compilingTitle}
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-white/48 mb-8">
                {isDemoMode ? copy.compilingDemoDescription : copy.compilingDescription}
              </p>

              <div className="w-full shrink-0 space-y-2 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-3 text-left shadow-[0_24px_80px_-36px_rgba(0,0,0,0.9)]">
                {copy.compilationSteps.map((label, index) => {
                  const complete = compileStep > index
                  return (
                    <motion.div
                      key={label}
                      initial={false}
                      animate={{ opacity: complete ? 1 : 0.36, y: 0 }}
                      className="flex min-h-12 items-center gap-3 rounded-2xl px-3"
                    >
                      <span className={`flex size-6 items-center justify-center rounded-full border ${complete ? 'border-[#B7F3D0]/35 bg-[#B7F3D0]/15 text-[#DDFBE8]' : 'border-white/[0.1] text-white/35'}`}>
                        {complete ? <Check className="size-3.5" strokeWidth={2} /> : <span className="size-1.5 rounded-full bg-current" />}
                      </span>
                      <span className="text-sm text-white/78">{label}</span>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* STAGE 3: SELF-DISCOVERY REPORT */}
          {stage === 'self_discovery' && (
            <motion.div
              key="self_discovery"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-between overflow-y-auto overscroll-contain p-6 md:p-8"
            >
              <div className="space-y-6">
                <div className="text-center">
                  <div className="relative mb-6 h-32 overflow-hidden rounded-3xl border border-white/[0.08]">
                    <Image src="/onboarding-rhythm.png" alt="" fill className="object-cover object-[center_70%]" sizes="36rem" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070709]/45 via-transparent to-transparent" />
                  </div>
                  <p className="text-[11px] font-semibold tracking-[0.13em] text-[#B7F3D0] uppercase">NOVO</p>
                  <h2 className="mt-2 text-[1.65rem] font-medium tracking-[-0.04em] text-white">{copy.profileTitle}</h2>
                </div>
                
                {/* Confidence Header — uses standardized primitives */}
                <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#B7F3D0]/[0.07] to-transparent p-5">
                  <div className="flex items-center gap-5">
                    <ConfidenceGauge score={twinData?.confidenceScore ?? 0} size="md" />
                    <div className="flex-1">
                      <p className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40 mb-1">{copy.profileAccuracy}</p>
                      <TrustBadge level={twinData?.trustLevel ?? 'initial'} />
                      <p className="text-[10px] text-white/30 font-medium mt-2 leading-relaxed">
                        {isDemoMode
                          ? copy.demoExplanation
                          : copy.profileExplanation}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-white/50 tracking-widest uppercase flex-shrink-0">
                      {isDemoMode ? 'Demo' : (twinData?.confidenceScore ?? 0) > 0 ? `${twinData?.confidenceScore}%` : 'Sin calibrar'}
                    </div>
                  </div>
                </div>

                {/* Profile Grid Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4">
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40">{copy.profileFocus}</span>
                    <h4 className="text-sm font-bold text-white mt-1 capitalize">
                      {copy.focusStyles[twinData?.identity?.focusStyle] ?? copy.focusStyles.deep_builder}
                    </h4>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4">
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40">{copy.profileWindow}</span>
                    <h4 className="text-sm font-bold text-[#B7F3D0] mt-1 uppercase">
                      {twinData?.energyCurve?.peakFocusStart
                        ? `${twinData.energyCurve.peakFocusStart} - ${twinData.energyCurve.peakFocusEnd}`
                        : '20:00 - 23:00'}
                    </h4>
                  </div>
                </div>

                {/* Diagnosis Narrative text */}
                <div className="space-y-2.5">
                  <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40 block">{copy.profileInsight}</span>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <p className="text-sm text-white/80 leading-relaxed font-medium">
                      {isDemoMode
                          ? copy.demoExplanation
                        : (twinData?.selfDiscoveryText || 'Analizando perfil...')}
                    </p>
                  </div>
                </div>

              </div>

              {/* Confirm initialization Action — demo mode has no Day 1 plan to
                  generate (its Twin comes from historical simulation, not this
                  interview), so it finalizes straight away. Real onboarding
                  continues into the day1_plan stage. */}
              <div className="mt-8 pt-4 border-t border-white/[0.05]">
                <p className="text-[11px] text-white/30 text-center mb-3 leading-relaxed">
                  {copy.templateNote}
                </p>
                <button
                  onClick={() => isDemoMode ? handleFinalize() : setStage('day1_plan')}
                  disabled={isFinalizing}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold tracking-wide text-black shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-[background-color,transform] duration-150 hover:bg-white/95 active:scale-[0.98]"
                >
                  {isFinalizing ? finalizationCopy[onboardingLanguage].saving : (isDemoMode ? copy.activate : copy.seePlan)}
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>
                {finalizeError && <p role="alert" className="mt-3 text-center text-xs text-rose-200">{finalizeError}</p>}
              </div>
            </motion.div>
          )}

          {/* STAGE 4: DAY 1 PLAN REVEAL */}
          {stage === 'day1_plan' && (
            <motion.div
              key="day1_plan"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-between overflow-y-auto overscroll-contain p-6 pb-28 md:p-8 md:pb-28"
            >
              <div className="space-y-6">
                <div className="text-center">
                  <div className="relative mb-6 h-40 overflow-hidden rounded-3xl border border-white/[0.08]">
                    <Image src="/onboarding-direction.png" alt="" fill className="object-cover object-[center_62%]" sizes="36rem" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070709]/55 via-transparent to-transparent" />
                  </div>
                  <h2 className="text-[1.65rem] font-medium tracking-[-0.04em] text-white mb-2">{copy.planTitle}</h2>
                  <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/48">{copy.planSubtitle}</p>
                </div>

                {!dayPlan ? (
                  <div className="flex items-center justify-center gap-2 text-white/40 text-xs py-10">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {copy.generatingPlan}
                  </div>
                ) : (
                  <div className="w-full space-y-2.5 text-left">
                    {dayPlan.tasks.map((task, i) => (
                      <motion.div key={task.id ?? i} initial={false} animate={{ opacity: planRevealStep > i ? 1 : 0.3 }} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[#B7F3D0]/30 bg-[#B7F3D0]/10 text-[#DDFBE8]"><Check className="size-3.5" /></span>
                            <span className="text-sm font-medium leading-snug text-white/88">{task.title}</span>
                          </div>
                          {planRevealStep > i && <span className="shrink-0 text-[10px] font-semibold text-[#DDFBE8]">{copy.taskReady}</span>}
                        </div>
                        {planRevealStep > i && dayPlan.reasoning[i] && (
                          <p className="mt-2 pl-9 text-xs leading-relaxed text-white/48">{dayPlan.reasoning[i]}</p>
                        )}
                      </motion.div>
                    ))}
                    {dayPlan.event && (
                      <motion.div initial={false} animate={{ opacity: planRevealStep > dayPlan.tasks.length ? 1 : 0.3, y: 0 }} className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.045] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 text-emerald-100"><Check className="size-3.5" /></span>
                            <span className="text-sm font-medium leading-snug text-white/88">{dayPlan.event.title}</span>
                          </div>
                          {planRevealStep > dayPlan.tasks.length && <span className="shrink-0 text-[10px] font-semibold text-emerald-200">{copy.eventReady}</span>}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 z-20 mt-8 pt-4 border-t border-white/[0.05] bg-gradient-to-t from-[#070709] via-[#070709]/95 to-transparent">
                <p className="text-[11px] text-white/30 text-center mb-3 leading-relaxed">
                  {copy.planNote}
                </p>
                <button
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold tracking-wide text-black shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-[background-color,transform] duration-150 hover:bg-white/95 active:scale-[0.98]"
                >
                  {isFinalizing ? finalizationCopy[onboardingLanguage].saving : copy.enter}
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>
                {finalizeError && <p role="alert" className="mt-3 text-center text-xs text-rose-200">{finalizeError}</p>}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#070709] text-white">
        <NovoSpriteLoader size="md" label="Novo" className="text-white" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}
