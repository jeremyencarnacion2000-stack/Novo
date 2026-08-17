import { NextResponse } from 'next/server'
import { groqAPI } from '@/lib/groq'
import { openRouterAPI } from '@/lib/openrouter'

const SYSTEM_PROMPT = `You are Novo's onboarding analyst. Read the user's onboarding conversation and infer their real cognitive/work profile from what they actually said — do not invent details they didn't mention or imply.

Return ONLY valid JSON (no markdown) with exactly this shape:
{
  "longTermGoal": "clean, concise restatement (1 sentence, in the requested interface language) of the user's stated 12-month goal",
  "identity": { "role": "student|founder|developer|creator|professional", "industry": string, "focusStyle": string, "deepWorkCapacity": number },
  "energyCurve": { "chronotype": "morning_lark|night_owl|intermediate", "peakFocusStart": "HH:MM", "peakFocusEnd": "HH:MM", "typicalSlumpHour": number },
  "metrics": { "currentCognitiveLoad": 0, "decisionFatigueRisk": "unknown", "burnoutIndex": 0 },
  "bottlenecks": { "mainFrictionPoint": "context_switching|procrastination|overcommitment|lack_of_structure", "motivationDrivers": string[], "planningPreference": "adaptive|rigid" },
  "workspaceLayout": { "enabledModules": string[] (from: today, ai, cognitive, focus, school, library, business, projects, music, trackers), "collapsedSidebar": false, "heroWidget": "cognitive_twin_orb" },
  "selfDiscoveryText": "2-3 sentence personalized diagnosis in the requested interface language, referencing what they specifically said"
}

Rules:
- Base every field on evidence in the transcript. If something wasn't discussed, use a reasonable default rather than guessing wildly.
- "today", "ai", "cognitive", "focus" are always in enabledModules; add role-relevant ones on top (school/library for students, business/projects for founders, projects for developers, music/projects for creators, trackers otherwise).
- selfDiscoveryText must feel specific to this person, not generic.`

const OUTPUT_LANGUAGE: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
}

async function analyzeWithLLM(textLog: string, language: string) {
  const userMessage = `Onboarding transcript:\n\n${textLog}`
  const prompt = `${SYSTEM_PROMPT}\n\nWrite longTermGoal and selfDiscoveryText in ${OUTPUT_LANGUAGE[language] || 'English'}.`
  let raw: string
  try {
    raw = (await groqAPI.generateResponse(userMessage, '', [], prompt, 'qwen/qwen3-32b')).content
  } catch (groqError) {
    console.error('[Onboarding Analyze] Groq failed, trying OpenRouter:', groqError)
    raw = (await openRouterAPI.generateResponse(userMessage, '', [], prompt, 'openai/gpt-oss-20b:free')).content
  }
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned)
}

// The "goals" onboarding step is the only free-text question — its question
// text always mentions "12 meses" (see STEPS in app/onboarding/page.tsx).
// Grabbing the user reply that immediately follows it gives the raw goal
// answer without the two files needing to share a schema.
function extractGoalAnswer(messages: any[]): string {
  const idx = messages.findIndex((m: any) => m.role === 'assistant' && /12 (meses|months|mois|monate)/i.test(m.content))
  return idx >= 0 && messages[idx + 1]?.role === 'user' ? messages[idx + 1].content.trim() : ''
}

export async function POST(req: Request) {
  try {
    const { messages, language = 'en' } = await req.json()
    const textLog = messages
      .map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
      .join('\n')
    const rawGoalAnswer = extractGoalAnswer(messages)

    try {
      const profile = await analyzeWithLLM(textLog, language)
      // Belt-and-suspenders: if the LLM ever drops the field, fall back to
      // the raw text the user typed rather than losing the goal entirely.
      profile.longTermGoal = profile.longTermGoal || rawGoalAnswer
      return NextResponse.json(profile)
    } catch (llmError) {
      console.error('[Onboarding Analyze] LLM analysis failed, falling back to heuristic parser:', llmError)
    }

    // Local heuristic fallback — only reached if every LLM provider failed or
    // returned unparseable JSON. Keeps onboarding working even if Groq/
    // OpenRouter are both down, at the cost of the generic profile below.
    // 1. Identity
    let role: 'student' | 'founder' | 'developer' | 'creator' | 'professional' = 'professional'
    if (/\[selection:student\]|estudiante|student|étudiant|studentin|studium|uni|universidad|classe?|colegio|escuela/i.test(textLog)) {
      role = 'student'
    } else if (/\[selection:founder\]|founder|fundador|fondateur|gründer|startup|ceo|empresa|emprendedor/i.test(textLog)) {
      role = 'founder'
    } else if (/\[selection:developer\]|dev|developer|développeur|entwickler|desarrollador|programador|código|codigo|code/i.test(textLog)) {
      role = 'developer'
    } else if (/\[selection:creator\]|creador|creator|créateur|kreativ|diseñador|designer|writer|video|música|musica/i.test(textLog)) {
      role = 'creator'
    }

    // 2. Chronotype / Energy Curve
    let chronotype: 'morning_lark' | 'night_owl' | 'intermediate' = 'intermediate'
    let peakFocusStart = '14:00'
    let peakFocusEnd = '18:00'
    let typicalSlumpHour = 13

    if (/\[selection:night\]|noche|madrugada|nocturno|evening|late night|soir|nacht/i.test(textLog)) {
      chronotype = 'night_owl'
      peakFocusStart = '20:00'
      peakFocusEnd = '01:00'
      typicalSlumpHour = 15
    } else if (/\[selection:morning\]|mañana|madrugar|temprano|morning|matin|morgen|früh/i.test(textLog)) {
      chronotype = 'morning_lark'
      peakFocusStart = '08:00'
      peakFocusEnd = '12:00'
      typicalSlumpHour = 14
    }

    // 3. Friction Points
    let mainFrictionPoint: 'context_switching' | 'procrastination' | 'overcommitment' | 'lack_of_structure' = 'lack_of_structure'
    if (/\[selection:procrastination\]|procrastin|aplaz|postergar|aufschieben/i.test(textLog)) {
      mainFrictionPoint = 'procrastination'
    } else if (/\[selection:context_switching\]|multitasking|alternar|switching|distra|notificaciones|wechsel/i.test(textLog)) {
      mainFrictionPoint = 'context_switching'
    } else if (/\[selection:overcommitment\]|muchas cosas|sobrecarga|too much|trop|zu viel|no llego/i.test(textLog)) {
      mainFrictionPoint = 'overcommitment'
    } else if (/\[selection:lack_of_structure\]/i.test(textLog)) {
      mainFrictionPoint = 'lack_of_structure'
    }

    // 4. Motivation Drivers
    const motivationDrivers: Array<'achievement' | 'urgency' | 'gamification' | 'minimalist_calm'> = []
    if (/\[selection:gamification\]|gamif|juego|puntos|recompensa|reward/i.test(textLog)) {
      motivationDrivers.push('gamification')
    }
    if (/\[selection:urgency\]|plazo|fecha|urgente|límite|limite|deadline|échéance|frist/i.test(textLog)) {
      motivationDrivers.push('urgency')
    }
    if (/\[selection:minimalist_calm\]|calma|calm|paz|orden|minimal|ruhig/i.test(textLog)) {
      motivationDrivers.push('minimalist_calm')
    }
    if (/\[selection:achievement\]/i.test(textLog)) {
      motivationDrivers.push('achievement')
    }
    if (motivationDrivers.length === 0) {
      motivationDrivers.push('achievement') // default
    }

    // 5. Recommended Modules
    const enabledModules = ['today', 'ai', 'cognitive', 'focus'] // core
    if (role === 'student') {
      enabledModules.push('school', 'library')
    } else if (role === 'founder') {
      enabledModules.push('business', 'projects')
    } else if (role === 'developer') {
      enabledModules.push('projects')
    } else if (role === 'creator') {
      enabledModules.push('music', 'projects')
    } else {
      enabledModules.push('trackers')
    }

    // 6. Generate Self-Discovery Paragraph
    let focusStyleName = 'Deep Builder'
    if (role === 'founder') focusStyleName = 'Dynamic Architect'
    if (role === 'professional') focusStyleName = 'System Optimizer'
    if (role === 'creator') focusStyleName = 'Creative Flowist'
    if (role === 'student') focusStyleName = 'Synaptic Explorer'

    let diagnosis = ''
    if (mainFrictionPoint === 'procrastination') {
      diagnosis = 'Tu principal fricción no es la falta de voluntad, sino la procrastinación provocada por la falta de un primer paso claro. Tu mente se paraliza cuando ve objetivos masivos.'
    } else if (mainFrictionPoint === 'context_switching') {
      diagnosis = 'Tu mente sufre de sobrecarga por alternancia de tareas (context switching). Intentas llevar muchas responsabilidades de forma paralela, agotando tu energía de manera ineficiente.'
    } else if (mainFrictionPoint === 'overcommitment') {
      diagnosis = 'El problema no es tu disciplina; es la sobrecarga cognitiva provocada por aceptar más responsabilidades de las que tu capacidad de foco diario permite gestionar.'
    } else {
      diagnosis = 'Tu mayor obstáculo es la falta de estructura. Creas planes detallados que no se adaptan cuando el día cambia, generando frustración.'
    }

    const energyText = chronotype === 'night_owl' 
      ? 'Rindes mejor de noche, pero la sociedad te fuerza a mañanas tempranas, consumiendo tus reservas antes del mediodía.'
      : 'Tu ventana óptima es matutina, lo que significa que el trabajo pesado debe resolverse antes de que comience el ruido de reuniones.'

    const fallbackNarratives: Record<string, string> = {
      es: `Basándome en nuestra conversación, identifico tu perfil como un ${focusStyleName}. ${diagnosis} ${energyText} Hemos optimizado Novo para estructurar tu espacio alrededor de esta realidad.`,
      en: `Based on our conversation, your starting profile is ${focusStyleName}. Your workspace is ready to learn from your real habits and help you take a clearer next step.`,
      fr: `D’après notre échange, votre profil de départ est ${focusStyleName}. Votre espace est prêt à apprendre de vos habitudes réelles et à vous aider à choisir une prochaine étape plus claire.`,
      de: `Aus unserem Gespräch ergibt sich als Ausgangspunkt das Profil ${focusStyleName}. Dein Bereich ist bereit, aus deinen echten Gewohnheiten zu lernen und dir den nächsten Schritt klarer zu machen.`,
    }
    const fullNarrative = fallbackNarratives[language] || fallbackNarratives.en

    return NextResponse.json({
      // Simplest correct thing: pass through the raw text they typed, we
      // have no LLM available here to clean it up.
      longTermGoal: rawGoalAnswer,
      identity: {
        role,
        industry: role === 'founder' ? 'Startup' : role === 'student' ? 'Academia' : 'Tecnología',
        focusStyle: focusStyleName.toLowerCase().replace(' ', '_'),
        deepWorkCapacity: role === 'student' ? 3.0 : 4.0,
      },
      energyCurve: {
        chronotype,
        peakFocusStart,
        peakFocusEnd,
        typicalSlumpHour,
      },
      // Onboarding answers can establish preferences, never biometrics or a
      // measured workload. Operational metrics begin uncalibrated.
      metrics: { currentCognitiveLoad: 0, decisionFatigueRisk: 'unknown', burnoutIndex: 0 },
      bottlenecks: {
        mainFrictionPoint,
        motivationDrivers,
        planningPreference: 'adaptive',
      },
      workspaceLayout: {
        enabledModules,
        collapsedSidebar: false,
        heroWidget: 'cognitive_twin_orb',
      },
      selfDiscoveryText: fullNarrative,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error processing onboarding data' }, { status: 500 })
  }
}
