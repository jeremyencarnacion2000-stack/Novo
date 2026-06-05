import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/cognitive-twin/demo
 * Seeds 30 days of behavioral signals, logs, and daily snapshots
 * to simulate realistic evolution of the user's Cognitive Twin.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // 1. Clean existing cognitive twin records, signals, snapshots, logs for a fresh start
    let twin = await prisma.cognitiveTwinRecord.findUnique({ where: { userId } })
    if (twin) {
      await prisma.twinSnapshot.deleteMany({ where: { twinId: twin.id } })
      await prisma.twinEvolutionLog.deleteMany({ where: { twinId: twin.id } })
      await prisma.behavioralSignal.deleteMany({ where: { twinId: twin.id } })
      await prisma.cognitiveTwinRecord.delete({ where: { id: twin.id } })
    }

    // 2. Initialize fresh twin
    const initialIdentity = {
      role: 'founder',
      industry: 'technology',
      focusStyle: 'deep_builder',
      deepWorkCapacity: 4.5,
    }
    const initialWorkspace = {
      enabledModules: ['today', 'ai', 'cognitive', 'focus', 'projects'],
      collapsedSidebar: false,
      heroWidget: 'cognitive_twin_orb',
    }

    twin = await prisma.cognitiveTwinRecord.create({
      data: {
        userId,
        confidenceScore: 42,
        trustLevel: 'initial',
        isInitialized: true,
        identity: initialIdentity,
        energyCurve: { chronotype: '', peakFocusStart: '', peakFocusEnd: '', typicalSlumpHour: 14 },
        metrics: { currentCognitiveLoad: 30, decisionFatigueRisk: 'low', burnoutIndex: 10 },
        bottlenecks: { mainFrictionPoint: '', motivationDrivers: ['achievement'], planningPreference: 'adaptive' },
        workspaceLayout: initialWorkspace,
        totalSignals: 0,
      },
    })

    // 3. Generate 30 days of signals & snapshots
    const signalsToCreate = []
    const snapshotsToCreate = []
    const logsToCreate = []

    let currentConfidence = 42
    let currentTotalSignals = 0

    // Energy state trackers
    let chronotype = ''
    let peakFocusStart = ''
    let peakFocusEnd = ''
    let mainFrictionPoint = ''
    let burnoutIndex = 10
    let cognitiveLoad = 30
    let decisionFatigue = 'low'

    const now = new Date()

    for (let day = 30; day >= 1; day--) {
      const date = new Date(now)
      date.setDate(now.getDate() - day)

      // Seeding realistic daily signals based on a Night Owl pattern
      // Focus sessions usually in late evening: 20:00 - 23:00 (Hour 20, 21, 22)
      // Some task deferrals to trigger procrastination or decision fatigue friction
      const dailySignals = [
        { signal: 'task_created', hour: 10 },
        { signal: 'task_created', hour: 11 },
        { signal: 'task_completed', hour: 11 },
        { signal: 'focus_started', hour: 20 },
        { signal: 'focus_finished', hour: 21, duration: 60, quality: 4 },
        { signal: 'focus_started', hour: 21 },
        { signal: 'focus_finished', hour: 22, duration: 50, quality: 5 },
      ]

      // Add a routine completed or skipped
      if (day % 3 === 0) {
        dailySignals.push({ signal: 'routine_completed', hour: 9 })
      } else {
        dailySignals.push({ signal: 'routine_skipped', hour: 9 })
      }

      // Add some task deferrals on specific days to trigger friction
      if (day % 4 === 0) {
        dailySignals.push({ signal: 'task_deferred', hour: 15 })
        dailySignals.push({ signal: 'task_deferred', hour: 16 })
      }

      // Write signals for this day
      for (const sig of dailySignals) {
        const sigDate = new Date(date)
        sigDate.setHours(sig.hour, 0, 0, 0)

        signalsToCreate.push({
          userId,
          twinId: twin.id,
          signal: sig.signal,
          hour: sig.hour,
          duration: sig.duration ?? null,
          quality: sig.quality ?? null,
          occurredAt: sigDate,
        })

        // Apply non-linear confidence growth per signal
        currentTotalSignals++
        if (currentConfidence < 60) currentConfidence += 0.75
        else if (currentConfidence < 80) currentConfidence += 0.28
        else if (currentConfidence < 95) currentConfidence += 0.07
        else currentConfidence += 0.015
      }

      // Trigger patterns on specific days to represent "learning" milestones
      if (day === 20) {
        // Chronotype detected (Night Owl)
        chronotype = 'night_owl'
        currentConfidence += 3 // Pattern bonus
        logsToCreate.push({
          twinId: twin.id,
          userId,
          changeType: 'chronotype_updated',
          description: 'Night owl pattern detected (78% of deep work focus sessions occur after 8pm)',
          prevValue: '',
          newValue: 'night_owl',
          createdAt: new Date(date),
        })
      }

      if (day === 15) {
        // Peak Performance Window detected
        peakFocusStart = '20:00'
        peakFocusEnd = '23:00'
        currentConfidence += 3 // Pattern bonus
        logsToCreate.push({
          twinId: twin.id,
          userId,
          changeType: 'peak_window_detected',
          description: 'Peak Performance Window detected: 20:00–23:00',
          prevValue: '',
          newValue: '20:00–23:00',
          createdAt: new Date(date),
        })
      }

      if (day === 10) {
        // Friction Point detected
        mainFrictionPoint = 'procrastination'
        currentConfidence += 3 // Pattern bonus
        logsToCreate.push({
          twinId: twin.id,
          userId,
          changeType: 'friction_detected',
          description: 'Procrastination pattern: 8 task deferrals detected in rolling 7-day window',
          prevValue: '',
          newValue: 'procrastination',
          createdAt: new Date(date),
        })
      }

      // Burnout and load fluctuations
      if (day <= 7) {
        burnoutIndex = Math.min(100, burnoutIndex + 8)
        cognitiveLoad = Math.min(100, cognitiveLoad + 7)
        if (day === 3) {
          logsToCreate.push({
            twinId: twin.id,
            userId,
            changeType: 'burnout_risk_raised',
            description: 'Burnout risk elevated: High cognitive load and low routine completion over past 3 days',
            prevValue: 'low',
            newValue: 'high',
            createdAt: new Date(date),
          })
        }
      } else {
        burnoutIndex = Math.max(10, burnoutIndex - 2)
        cognitiveLoad = Math.max(20, cognitiveLoad - 3)
      }

      // Derived trust levels
      let trustLevel = 'initial'
      if (currentConfidence >= 91) trustLevel = 'validated'
      else if (currentConfidence >= 76) trustLevel = 'adapted'
      else if (currentConfidence >= 56) trustLevel = 'learning'

      // Log trust level upgrades
      const prevTrust = day === 30 ? 'initial' : (snapshotsToCreate[snapshotsToCreate.length - 1]?.trustLevel ?? 'initial')
      if (trustLevel !== prevTrust) {
        logsToCreate.push({
          twinId: twin.id,
          userId,
          changeType: 'trust_level_up',
          description: `Trust level upgraded: ${prevTrust} → ${trustLevel} (confidence: ${currentConfidence.toFixed(1)}%)`,
          prevValue: prevTrust,
          newValue: trustLevel,
          createdAt: new Date(date),
        })
      }

      // Create snapshot for end of this day
      const snapshotDate = new Date(date)
      snapshotDate.setHours(23, 59, 59, 999)

      snapshotsToCreate.push({
        twinId: twin.id,
        userId,
        confidenceScore: Math.min(100, +currentConfidence.toFixed(2)),
        trustLevel,
        cognitiveLoad,
        burnoutIndex,
        chronotype,
        mainFrictionPoint,
        peakFocusStart,
        peakFocusEnd,
        totalSignals: currentTotalSignals,
        snapshotDate,
      })
    }

    // 4. Save everything to DB in transaction
    await prisma.$transaction([
      prisma.behavioralSignal.createMany({ data: signalsToCreate }),
      prisma.twinSnapshot.createMany({ data: snapshotsToCreate }),
      prisma.twinEvolutionLog.createMany({ data: logsToCreate }),
      prisma.cognitiveTwinRecord.update({
        where: { id: twin.id },
        data: {
          confidenceScore: Math.min(100, +currentConfidence.toFixed(2)),
          trustLevel: currentConfidence >= 91 ? 'validated' : currentConfidence >= 76 ? 'adapted' : currentConfidence >= 56 ? 'learning' : 'initial',
          isInitialized: true,
          totalSignals: currentTotalSignals,
          energyCurve: { chronotype, peakFocusStart, peakFocusEnd, typicalSlumpHour: 14 },
          metrics: { currentCognitiveLoad: cognitiveLoad, decisionFatigueRisk: decisionFatigue, burnoutIndex },
          bottlenecks: { mainFrictionPoint, motivationDrivers: ['achievement'], planningPreference: 'adaptive' },
        },
      }),
    ])

    const updatedTwin = await prisma.cognitiveTwinRecord.findUnique({
      where: { userId },
      include: {
        evolutionLog: { orderBy: { createdAt: 'desc' }, take: 10 },
        snapshots: { orderBy: { snapshotDate: 'desc' }, take: 30 },
      },
    })

    return NextResponse.json({ success: true, twin: updatedTwin })
  } catch (error) {
    console.error('[cognitive-twin/demo POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
