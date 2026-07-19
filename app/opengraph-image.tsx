import { ImageResponse } from 'next/og'

// App Router special file — Next.js auto-wires the og:image/twitter:image
// meta tags to whatever this exports, at the standard 1200x630 size. Built
// with next/og's ImageResponse (Satori under the hood) instead of a static
// PNG so it always matches the current brand palette without needing a
// design tool round-trip. Matches app/landing/page.tsx's dark-first identity
// (#0A0C0B base, #22D3C4 teal accent) — link previews (WhatsApp, X, LinkedIn,
// Discord) are often someone's first look at the product, so this shouldn't
// be a stale cream+indigo card while the product itself is dark+teal.
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0C0B',
          position: 'relative',
        }}
      >
        {/* Soft teal glow, echoing the landing hero's radial glow */}
        <div
          style={{
            position: 'absolute',
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,211,196,0.22) 0%, transparent 70%)',
            top: -250,
            left: 150,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              border: '2px solid #22D3C4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(34,211,196,0.08)',
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid #22D3C4', display: 'flex' }} />
          </div>
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: '#F1F5F3', letterSpacing: -1 }}>
            NOVO
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 40,
            fontWeight: 300,
            fontStyle: 'italic',
            color: '#F1F5F3',
            marginTop: 36,
            maxWidth: 880,
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          Deja de organizar tareas. Empieza a ejecutar con tu energía real.
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 22,
            color: 'rgba(241,245,243,0.5)',
            marginTop: 28,
            letterSpacing: 4,
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          Cognitive Operating System
        </div>
      </div>
    ),
    { ...size }
  )
}
