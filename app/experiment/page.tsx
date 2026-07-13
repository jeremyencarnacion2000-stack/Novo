'use client'

// Deliberately unstyled beyond basic layout — this is pilot instrumentation,
// not a product surface. No glass, no motion system, no dashboard redesign.
// Per the pre-registration: no UI work is allowed here beyond what's needed
// to show the window and record the two self-report metrics.

import { useEffect, useState } from 'react'

interface TodayResponse {
  active: boolean
  dayNumber?: number
  windowStart?: string
  windowEnd?: string
  subjectiveFocusScore?: number | null
  subjectiveFatigueScore?: number | null
}

export default function ExperimentPage() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [focusScore, setFocusScore] = useState(3)
  const [fatigueScore, setFatigueScore] = useState(3)
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/experiment/today')
      .then((r) => r.json())
      .then((d: TodayResponse) => {
        setData(d)
        if (d.subjectiveFocusScore) setFocusScore(d.subjectiveFocusScore)
        if (d.subjectiveFatigueScore) setFatigueScore(d.subjectiveFatigueScore)
      })
      .finally(() => setLoading(false))
  }, [])

  const submitCheckin = async () => {
    const res = await fetch('/api/experiment/today', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectiveFocusScore: focusScore, subjectiveFatigueScore: fatigueScore, notes }),
    })
    if (res.ok) setSaved(true)
  }

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Behavioral Pilot</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Interruption-frequency deep-work window experiment</p>

      {loading && <p>Loading...</p>}

      {!loading && data && !data.active && (
        <p style={{ color: '#888' }}>No experiment day scheduled for today.</p>
      )}

      {!loading && data?.active && (
        <div style={{ border: '1px solid #333', borderRadius: 8, padding: 20 }}>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Day {data.dayNumber} of 28</p>
          <p style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
            Recommended deep-work window: {fmt(data.windowStart)} – {fmt(data.windowEnd)}
          </p>

          <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '16px 0' }} />

          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>End-of-day check-in</p>

          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Focus quality today (1-5): {focusScore}
          </label>
          <input type="range" min={1} max={5} value={focusScore} onChange={(e) => setFocusScore(Number(e.target.value))} style={{ width: '100%', marginBottom: 16 }} />

          <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Fatigue today (1-5): {fatigueScore}
          </label>
          <input type="range" min={1} max={5} value={fatigueScore} onChange={(e) => setFatigueScore(Number(e.target.value))} style={{ width: '100%', marginBottom: 16 }} />

          <textarea
            placeholder="Optional notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: '100%', minHeight: 60, marginBottom: 16, background: 'transparent', border: '1px solid #333', borderRadius: 6, padding: 8, color: 'inherit' }}
          />

          <button
            onClick={submitCheckin}
            style={{ background: '#fff', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
          >
            {saved ? 'Saved ✓' : 'Save check-in'}
          </button>
        </div>
      )}
    </div>
  )
}
