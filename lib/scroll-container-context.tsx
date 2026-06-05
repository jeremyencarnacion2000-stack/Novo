'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface ScrollContainerContextValue {
  /** The current scrollable DOM element (the motion.div that holds page content) */
  scrollContainer: HTMLElement | null
  /** Called by DashboardShell when the motion.div mounts/unmounts */
  setScrollContainer: (el: HTMLElement | null) => void
}

const ScrollContainerContext = createContext<ScrollContainerContextValue>({
  scrollContainer: null,
  setScrollContainer: () => {},
})

export function ScrollContainerProvider({ children }: { children: React.ReactNode }) {
  const [scrollContainer, setScrollContainerState] = useState<HTMLElement | null>(null)

  const setScrollContainer = useCallback((el: HTMLElement | null) => {
    setScrollContainerState(el)
  }, [])

  return (
    <ScrollContainerContext.Provider value={{ scrollContainer, setScrollContainer }}>
      {children}
    </ScrollContainerContext.Provider>
  )
}

export function useScrollContainer() {
  return useContext(ScrollContainerContext)
}
