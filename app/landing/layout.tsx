import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Novo - Sistema cognitivo personal',
  description: 'Novo convierte tu contexto real en una siguiente acción clara, con foco, tareas y un Gemelo Cognitivo privado.',
  alternates: { canonical: '/landing' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Novo - Sistema cognitivo personal',
    description: 'Una dirección clara para el momento correcto.',
    url: '/landing',
    type: 'website',
  },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children
}
