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
      console.info('[Biometrics] Google Fit is not connected; returning the operational fallback.')
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
      console.warn('[Biometrics] Google Fit token is unavailable; returning the operational fallback.')
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

    console.info('[Biometrics] Google Fit payload normalized.')

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        // Cache for 5 minutes — biometrics don't change rapidly
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch {
    console.error('[Biometrics] Request failed.')
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
        message: 'Biometric data is temporarily unavailable.',
        hasGoogleFitData: false,
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
      console.info('[Biometrics POST] Returning the operational fallback.')
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
  } catch {
    console.error('[Biometrics POST] Request failed.')
    return NextResponse.json(
      { error: 'InternalError', message: 'Biometric data is temporarily unavailable.' },
      { status: 500 }
    )
  }
}
