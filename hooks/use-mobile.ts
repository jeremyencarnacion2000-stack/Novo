import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  // useLayoutEffect (not useEffect): runs before paint, so callers that
  // branch their whole render tree on this value (e.g. dashboard-client.tsx
  // mounting an entirely different desktop/mobile layout) never flash the
  // wrong one on first frame — a real, visible cost on the dashboard, which
  // mounts 3 GlassSurface/SVG-filter instances in the desktop branch alone.
  React.useLayoutEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}
