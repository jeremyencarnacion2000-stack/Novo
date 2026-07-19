'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Brain, ArrowRight, Sparkles, Send, RefreshCw } from 'lucide-react'
import { OrbPrimitive, ConfidenceGauge, TrustBadge } from '@/components/cognitive/primitives'
import { useCognitiveTwin } from '@/lib/cognitive-twin-context'

interface Message {
  role: 'assistant' | 'user'
  content: string
}

// Base Twin profile used when the analysis endpoint is slow/unreachable. Shared
// by the compilation timeout fallback AND handleFinalize, so finishing
// onboarding ALWAYS initializes the Twin — never a dead "Finalize" button that
// leaves a brand-new user stuck in the /onboarding redirect loop.
const DEFAULT_TWIN_DATA = {
  confidenceScore: 42,
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

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemoMode = searchParams?.get('demo') === 'twin'
  const { initializeTwin } = useCognitiveTwin()
  const { data: session } = useSession()

  const [currentStep, setCurrentStep] = useState(0)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Bienvenido a Novo. No soy una app de tareas común: soy un Sistema Operativo Cognitivo, y vamos a construir tu Cognitive Twin juntos. Cada respuesta que me des lo hace más tuyo. ¿Empezamos?' }
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
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Trigger Demo flow on mount if demo=twin parameter is present
  useEffect(() => {
    if (isDemoMode) {
      triggerDemoSeeding()
    }
  }, [isDemoMode])

  const triggerDemoSeeding = async () => {
    setStage('compilation')
    try {
      const response = await fetch('/api/cognitive-twin/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success && data.twin) {
        setTwinData(data.twin)
      }
    } catch (e) {
      console.error('Failed to seed demo twin data:', e)
    }

    // Run compile visual steps (fast-forwarded for demo mode)
    const compileTimings = [200, 400, 600, 800, 1000]
    compileTimings.forEach((time, index) => {
      setTimeout(() => {
        setCompileStep(index + 1)
        if (index === compileTimings.length - 1) {
          setTimeout(() => {
            setStage('self_discovery')
          }, 400)
        }
      }, time)
    })
  }

  // Dynamic next step trigger
  const handleAnswer = (answerText: string, value: string) => {
    // Add User response
    setMessages(prev => [...prev, { role: 'user', content: answerText }])
    
    setTimeout(() => {
      if (currentStep < STEPS.length - 1) {
        const next = currentStep + 1
        setCurrentStep(next)
        setMessages(prev => [...prev, { role: 'assistant', content: STEPS[next].question }])
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

    // clearTimeout doesn't help once the timer has already fired: if
    // /api/onboarding/analyze takes >=8s, the fallback branch below AND the
    // success branch after `await fetch` both ran, each calling
    // triggerDayPlan → POST /api/onboarding/day-plan, which unconditionally
    // creates real tasks + a calendar event with no dedup guard server-side
    // — a new user got their Day 1 plan created twice. One local flag shared
    // by both closures (this function runs once per onboarding session)
    // makes "first one wins" instead of "both can win".
    let dayPlanStarted = false

    // Call analysis endpoint with conversation history
    // 8-second timeout — fallback to default twin values to avoid infinite loading
    const analyzeTimeout = setTimeout(() => {
      if (!twinData && !dayPlanStarted) {
        dayPlanStarted = true
        setTwinData(DEFAULT_TWIN_DATA)
        triggerDayPlan(DEFAULT_TWIN_DATA)
      }
    }, 8000)

    try {
      const response = await fetch('/api/onboarding/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })
      const data = await response.json()
      clearTimeout(analyzeTimeout)
      setTwinData(data)
      if (!dayPlanStarted) {
        dayPlanStarted = true
        triggerDayPlan(data)
      }
    } catch (e) {
      console.error(e)
      // timeout fallback will fire at 8s
    }

    // Run compile visual steps
    const compileTimings = [800, 1600, 2400, 3200, 4200]
    compileTimings.forEach((time, index) => {
      setTimeout(() => {
        setCompileStep(index + 1)
        if (index === compileTimings.length - 1) {
          setTimeout(() => {
            setStage('self_discovery')
          }, 1500)
        }
      }, time)
    })
  }

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

  const handleFinalize = () => {
    // Always initialize — fall back to the base profile if the analysis hasn't
    // resolved yet, so the button is never inert and no new user gets stranded.
    const data = twinData ?? DEFAULT_TWIN_DATA
    initializeTwin({
      ...data,
      isInitialized: true,
      confidenceScore: data.confidenceScore ?? 42,
      trustLevel: data.trustLevel ?? 'initial'
    })
    // The Day 1 plan (when generated) already created real tasks/events, so
    // land directly on /today instead of the empty dashboard root.
    router.push('/today')
  }

  const activeStep = STEPS[currentStep]

  return (
    <div className="fixed inset-0 bg-[#070709] text-white flex flex-col font-sans overflow-hidden">
      {/* Immersive Neural background dots */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
        backgroundSize: '32px 32px'
      }} />
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-30 blur-[150px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-20 blur-[150px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

      {/* HEADER */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] relative z-10 bg-[#070709]/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
            <Brain className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-xs font-black tracking-[0.25em] uppercase text-white/90">Novo Cognitive System</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            {isDemoMode ? 'Demo Seeding Active' : 'Calibration Node'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${isDemoMode ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400 animate-pulse'}`} />
        </div>
      </div>

      {/* PROGRESS — goal-gradient: showing how close the user is drives completion */}
      {stage === 'interview' && (
        <div className="px-8 py-3 border-b border-white/[0.05] bg-[#070709]/60 relative z-10">
          <div className="max-w-2xl mx-auto flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tu Cognitive Twin</span>
            <span className="text-[10px] font-bold text-indigo-400">{Math.round((currentStep / STEPS.length) * 100)}% construido</span>
          </div>
          <div className="max-w-2xl mx-auto h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              initial={false}
              animate={{ width: `${(currentStep / STEPS.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
        </div>
      )}

      {/* STAGE CONTAINER */}
      <div className="flex-1 flex flex-col relative">
        <AnimatePresence mode="wait">
          
          {/* STAGE 1: NEURAL INTERVIEW */}
          {stage === 'interview' && (
            <motion.div
              key="interview"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex flex-col max-w-2xl w-full mx-auto p-6 md:p-10 justify-between h-full relative z-10"
            >
              {/* Chat log */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar pb-10">
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
                        m.role === 'user'
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/80'
                      }`}
                      style={{
                        backdropFilter: 'blur(12px)',
                        boxShadow: m.role === 'user' ? '0 4px 15px rgba(99,102,241,0.1)' : 'none'
                      }}
                    >
                      {m.content}
                    </div>
                  </motion.div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Interaction Panel */}
              <div className="mt-4 pt-4 border-t border-white/[0.05]">
                {activeStep && activeStep.options ? (
                  // Multiple Choice Selection
                  <div className="flex flex-col gap-2">
                    {activeStep.options.map((opt) => (
                      <motion.button
                        key={opt.value}
                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.03)' }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleAnswer(opt.label, opt.value)}
                        className="w-full text-left px-5 py-3.5 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:border-indigo-500/40 text-xs font-semibold tracking-wide transition-all flex justify-between items-center group"
                      >
                        <span className="text-white/70 group-hover:text-white transition-colors">{opt.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  // Custom Text Input Form
                  <form onSubmit={handleCustomInputSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder={activeStep?.placeholder ?? 'Escribe tu respuesta aquí...'}
                      className="flex-1 h-12 px-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.05] border border-white/[0.08] focus:border-indigo-500/50 text-xs text-white placeholder-white/20 focus:outline-none transition-all"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="h-12 w-12 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 flex items-center justify-center text-white transition-all shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}

          {/* STAGE 2: TWIN COMPILATION ANIMATION */}
          {stage === 'compilation' && (
            <motion.div
              key="compilation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md w-full mx-auto relative z-10"
            >
              {/* Cognitive Orb — uses standardized OrbPrimitive */}
              <div className="mb-10">
                <OrbPrimitive size="xl" variant="thinking" pulse glow />
              </div>

              <h2 className="text-xl font-bold tracking-tight text-white mb-2">
                {isDemoMode ? 'Simulando 30 días de evolución...' : 'Construyendo tu Cognitive Twin'}
              </h2>
              <p className="text-xs text-white/30 tracking-widest uppercase mb-8">
                {isDemoMode ? 'Cargando registros históricos' : 'Inicialización del espacio de trabajo'}
              </p>

              {/* Compilation logs */}
              <div className="w-full space-y-3.5 border border-white/[0.05] rounded-2xl p-5 bg-white/[0.01] backdrop-blur-xl text-left">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={compileStep >= 1 ? 'text-indigo-400 font-bold' : 'text-white/20'}>
                    [1] Calibrando curva de energía...
                  </span>
                  {compileStep >= 1 && <span className="text-indigo-400">OK</span>}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={compileStep >= 2 ? 'text-indigo-400 font-bold' : 'text-white/20'}>
                    [2] Modelando fatiga de decisión...
                  </span>
                  {compileStep >= 2 && <span className="text-indigo-400">OK</span>}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={compileStep >= 3 ? 'text-indigo-400 font-bold' : 'text-white/20'}>
                    [3] Identificando estilo de foco...
                  </span>
                  {compileStep >= 3 && <span className="text-indigo-400">OK</span>}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={compileStep >= 4 ? 'text-indigo-400 font-bold' : 'text-white/20'}>
                    [4] Compilando Cognitive Twin...
                  </span>
                  {compileStep >= 4 && <span className="text-indigo-400">{isDemoMode ? '89.4% (Avanzado)' : '42% (Iniciado)'}</span>}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={compileStep >= 5 ? 'text-emerald-400 font-bold animate-pulse' : 'text-white/20'}>
                    [5] Hidratando espacio de trabajo...
                  </span>
                  {compileStep >= 5 && <span className="text-emerald-400">COMPLETADO</span>}
                </div>
              </div>
            </motion.div>
          )}

          {/* STAGE 3: SELF-DISCOVERY REPORT */}
          {stage === 'self_discovery' && (
            <motion.div
              key="self_discovery"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col justify-between max-w-xl w-full mx-auto p-6 md:p-8 relative z-10 h-full overflow-y-auto animate-in fade-in duration-500"
            >
              <div className="space-y-6">
                
                {/* Confidence Header — uses standardized primitives */}
                <div className="rounded-3xl border border-white/[0.08] p-5 bg-gradient-to-b from-indigo-500/10 to-transparent backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-5">
                    <ConfidenceGauge score={twinData?.confidenceScore ?? 42} size="md" />
                    <div className="flex-1">
                      <p className="text-[9px] font-black tracking-[0.25em] uppercase text-white/30 mb-1">COGNITIVE ACCURACY</p>
                      <TrustBadge level={twinData?.trustLevel ?? 'initial'} />
                      <p className="text-[10px] text-white/30 font-medium mt-2 leading-relaxed">
                        {isDemoMode
                          ? 'Simulación de 30 días completada con señales comportamentales históricas.'
                          : 'Tu Twin aprenderá y aumentará su precisión analizando tus hábitos reales.'}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[9px] font-bold text-white/50 tracking-widest uppercase flex-shrink-0">
                      {isDemoMode ? 'Demo' : 'Calibrado'}
                    </div>
                  </div>
                </div>

                {/* Profile Grid Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4">
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/30">Perfil de Foco</span>
                    <h4 className="text-sm font-bold text-white mt-1 capitalize">
                      {twinData?.identity?.focusStyle === 'deep_builder' ? 'Constructor Profundo' :
                       twinData?.identity?.focusStyle === 'reactive_communicator' ? 'Comunicador Reactivo' :
                       twinData?.identity?.focusStyle === 'frantic_juggler' ? 'Malabarista Frenético' :
                       twinData?.identity?.focusStyle === 'consistent_planner' ? 'Planificador Consistente' :
                       'Constructor Profundo'}
                    </h4>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4">
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/30">Ventana de Foco</span>
                    <h4 className="text-sm font-bold text-indigo-400 mt-1 uppercase">
                      {twinData?.energyCurve?.peakFocusStart
                        ? `${twinData.energyCurve.peakFocusStart} - ${twinData.energyCurve.peakFocusEnd}`
                        : '20:00 - 23:00'}
                    </h4>
                  </div>
                </div>

                {/* Diagnosis Narrative text */}
                <div className="space-y-2.5">
                  <span className="text-[9px] font-black tracking-[0.25em] uppercase text-white/30 block">Auto-Análisis Cognitivo</span>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-5 backdrop-blur-xl">
                    <p className="text-sm text-white/80 leading-relaxed font-medium">
                      {isDemoMode
                        ? 'Usuario clasificado como Búho Nocturno con alta capacidad de foco en horas de la noche. Detectada tendencia leve a la procrastinación en tareas complejas y fatiga acumulada durante las tardes.'
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
                  Lo construiste vos, respondiendo {STEPS.length} preguntas — no es una plantilla genérica.
                </p>
                <button
                  onClick={() => isDemoMode ? handleFinalize() : setStage('day1_plan')}
                  className="w-full h-14 rounded-2xl bg-white hover:bg-white/95 text-black font-bold text-sm tracking-wide active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2"
                >
                  {isDemoMode ? 'Activar Mi Cognitive Twin' : 'Ver Mi Plan de Día 1'}
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE 4: DAY 1 PLAN REVEAL — reuses the compilation stage's
              terminal-log visual language to reveal each real task/event the
              backend just created via generateAndExecuteDayPlan */}
          {stage === 'day1_plan' && (
            <motion.div
              key="day1_plan"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col justify-between max-w-xl w-full mx-auto p-6 md:p-8 relative z-10 h-full overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="text-center">
                  <div className="mb-6 flex justify-center">
                    <OrbPrimitive size="lg" variant="thinking" pulse glow />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white mb-2">Tu Plan de Día 1</h2>
                  <p className="text-xs text-white/30 tracking-widest uppercase">
                    Calibrado a tu meta, tu energía y tu fricción
                  </p>
                </div>

                {!dayPlan ? (
                  <div className="flex items-center justify-center gap-2 text-white/40 text-xs py-10">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generando tu primer día...
                  </div>
                ) : (
                  <div className="w-full space-y-3.5 border border-white/[0.05] rounded-2xl p-5 bg-white/[0.01] backdrop-blur-xl text-left">
                    {dayPlan.tasks.map((task, i) => (
                      <div key={task.id ?? i} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono gap-3">
                          <span className={planRevealStep > i ? 'text-indigo-400 font-bold' : 'text-white/20'}>
                            [{i + 1}] {task.title}
                          </span>
                          {planRevealStep > i && <span className="text-indigo-400 flex-shrink-0">OK</span>}
                        </div>
                        {planRevealStep > i && dayPlan.reasoning[i] && (
                          <p className="text-[11px] text-white/40 pl-6 leading-relaxed">{dayPlan.reasoning[i]}</p>
                        )}
                      </div>
                    ))}
                    {dayPlan.event && (
                      <div className="space-y-1 pt-2 border-t border-white/[0.05]">
                        <div className="flex items-center justify-between text-[11px] font-mono gap-3">
                          <span className={planRevealStep > dayPlan.tasks.length ? 'text-emerald-400 font-bold animate-pulse' : 'text-white/20'}>
                            [{dayPlan.tasks.length + 1}] {dayPlan.event.title}
                          </span>
                          {planRevealStep > dayPlan.tasks.length && <span className="text-emerald-400 flex-shrink-0">AGENDADO</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-4 border-t border-white/[0.05]">
                <p className="text-[11px] text-white/30 text-center mb-3 leading-relaxed">
                  Ya está en tu lista — no tenés que planificar nada más hoy.
                </p>
                <button
                  onClick={handleFinalize}
                  className="w-full h-14 rounded-2xl bg-white hover:bg-white/95 text-black font-bold text-sm tracking-wide active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2"
                >
                  Entrar — ya está listo
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>
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
      <div className="fixed inset-0 bg-[#070709] flex items-center justify-center text-white">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}
