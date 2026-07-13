/**
 * API Route: /api/cognitive/biometrics
 * ─────────────────────────────────────────────────────────────────────────────
 * Biometric ingestion endpoint for the Novo Heritage Cognitive Engine.
 *
 * GET  → Fetch and return normalized biometric payload from Google Fit.
 * POST → Same as GET but allows passing override parameters for testing.
 *
 * Authentication: Requires active NextAuth session with Google provider
 *                 and fitness.activity.read + fitness.body.read scopes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchBiometricPayload } from '@/lib/google-fit'
import { fetchDbBiometricPayload } from '@/lib/db-biometrics'
import { getGoogleAccessToken } from '@/lib/google'
import type { BiometricPayload } from '@/types/biometrics'

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required.' },
        { status: 401 }
      )
    }

    // Check provider — if not Google, compute real-world metrics from the database instead of falling back to mock 50!
    if (session.provider && session.provider !== 'google') {
      console.log(`[Biometrics] Provider is not google (${session.provider}). Fetching real user metrics from database...`)
      const payload = await fetchDbBiometricPayload(session.user.id)
      return NextResponse.json(payload, {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      })
    }

    const accessToken = await getGoogleAccessToken(
      session.user.id,
      (session as any)?.accessToken
    )

    if (!accessToken) {
      console.warn('[Biometrics] No valid Google access token available. Using real user metrics from database.')
      const payload = await fetchDbBiometricPayload(session.user.id)
      return NextResponse.json(payload, {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      })
    }

    // ── Execute biometric ingestion ─────────────────────────────────────────
    const payload: BiometricPayload = await fetchBiometricPayload(
      accessToken,
      session.user.id
    )

    console.log(
      `[Biometrics] ✅ Payload computed for user ${session.user.id}:`,
      `stress=${payload.userStressScore} (${payload.stressLevel}),`,
      `sleep=${payload.sleep.totalSleepMinutes}min,`,
      `hr=${payload.heartRate.hasData ? payload.heartRate.averageBpm + 'bpm' : 'no-data'}`
    )

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        // Cache for 5 minutes — biometrics don't change rapidly
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (error: any) {
    console.error('[Biometrics] Unhandled error:', error)
    try {
      const session = await getServerSession(authOptions)
      if (session?.user?.id) {
        const payload = await fetchDbBiometricPayload(session.user.id)
        return NextResponse.json(payload, { status: 200 })
      }
    } catch (_) {}

    return NextResponse.json(
      {
        error: 'InternalError',
        message: error?.message ?? 'Failed to compute biometric payload.',
        hasGoogleFitData: false,
        userStressScore: 50,
        stressLevel: 'moderate',
      },
      { status: 500 }
    )
  }
}

// ─── POST Handler (Testing / Override) ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Allow POST body to override query window or force fallback
    const body = await request.json().catch(() => ({}))
    const { forceFallback } = body as { forceFallback?: boolean }

    if (forceFallback) {
      console.log('[Biometrics POST] forceFallback is active. Loading real database-driven payload.')
      const payload = await fetchDbBiometricPayload(session.user.id)
      return NextResponse.json(payload)
    }

    // Default POST behavior: same as GET
    const accessToken = await getGoogleAccessToken(
      session.user.id,
      (session as any)?.accessToken
    )

    if (!accessToken) {
      const payload = await fetchDbBiometricPayload(session.user.id)
      return NextResponse.json(payload)
    }

    const payload = await fetchDbBiometricPayload(session.user.id)
    return NextResponse.json(payload)
  } catch (error: any) {
    console.error('[Biometrics POST] Error:', error)
    return NextResponse.json(
      { error: 'InternalError', message: error?.message },
      { status: 500 }
    )
  }
}
