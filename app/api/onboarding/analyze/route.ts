import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    const textLog = messages
      .map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
      .join('\n')

    // Local heuristic engine to parse transcripts (ensures 100% reliability for offline/demo/hackathon environments)
    // 1. Identity
    let role: 'student' | 'founder' | 'developer' | 'creator' | 'professional' = 'professional'
    if (/estudiante|estudio|uni|universidad|clase|colegio|escuela/i.test(textLog)) {
      role = 'student'
    } else if (/founder|fundador|startup|ceo|empresa|emprendedor/i.test(textLog)) {
      role = 'founder'
    } else if (/dev|developer|desarrollador|programador|codigo|code/i.test(textLog)) {
      role = 'developer'
    } else if (/creador|creator|diseñador|writer|video|musica/i.test(textLog)) {
      role = 'creator'
    }

    // 2. Chronotype / Energy Curve
    let chronotype: 'morning_lark' | 'night_owl' | 'afternoon_peak' = 'afternoon_peak'
    let peakFocusStart = '14:00'
    let peakFocusEnd = '18:00'
    let typicalSlumpHour = 13

    if (/noche|tarde|madrugada|nocturno/i.test(textLog)) {
      chronotype = 'night_owl'
      peakFocusStart = '20:00'
      peakFocusEnd = '01:00'
      typicalSlumpHour = 15
    } else if (/mañana|madrugar|temprano/i.test(textLog)) {
      chronotype = 'morning_lark'
      peakFocusStart = '08:00'
      peakFocusEnd = '12:00'
      typicalSlumpHour = 14
    }

    // 3. Friction Points
    let mainFrictionPoint: 'context_switching' | 'procrastination' | 'overcommitment' | 'lack_of_structure' = 'lack_of_structure'
    if (/procrastinar|aplaz|postergar/i.test(textLog)) {
      mainFrictionPoint = 'procrastination'
    } else if (/multitasking|alternar|distra|notificaciones/i.test(textLog)) {
      mainFrictionPoint = 'context_switching'
    } else if (/muchas cosas|sobrecarga|tiempo|no llego/i.test(textLog)) {
      mainFrictionPoint = 'overcommitment'
    }

    // 4. Motivation Drivers
    const motivationDrivers: Array<'achievement' | 'urgency' | 'gamification' | 'minimalist_calm'> = []
    if (/gamif|juego|puntos|recompensa/i.test(textLog)) {
      motivationDrivers.push('gamification')
    }
    if (/plazo|fecha|urgente|limite/i.test(textLog)) {
      motivationDrivers.push('urgency')
    }
    if (/calma|paz|orden|minimal/i.test(textLog)) {
      motivationDrivers.push('minimalist_calm')
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

    const fullNarrative = `Basándome en nuestra conversación, identifico tu perfil como un ${focusStyleName}. ${diagnosis} ${energyText} Hemos optimizado Novo para estructurar tu espacio alrededor de esta realidad.`

    return NextResponse.json({
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
      metrics: {
        currentCognitiveLoad: role === 'student' || role === 'founder' ? 65 : 45,
        decisionFatigueRisk: role === 'founder' ? 'high' : 'moderate',
        burnoutIndex: role === 'founder' ? 55 : 35,
      },
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
