import { NextResponse } from 'next/server'

/**
 * Synthetic Twin seeding was retired. A production account must never lose its
 * history or receive fabricated behavioural signals merely by opening a demo
 * flow. The onboarding UI falls back to the explicit uncalibrated state.
 */
export async function POST() {
  return NextResponse.json({
    error: 'Synthetic Twin demos are disabled. Novo starts uncalibrated and learns from owned signals.',
    code: 'synthetic_twin_demo_disabled',
  }, { status: 410 })
}
