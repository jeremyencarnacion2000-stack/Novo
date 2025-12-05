'use client'

import { createContext, useContext, ReactNode } from 'react'

interface PlayerContextType {
  player: any
  currentTrack: any
  play: (uri: string) => Promise<void>
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  return (
    <PlayerContext.Provider value={{
      player: null,
      currentTrack: null,
      play: () => Promise.resolve()
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)

  // Return mock object for server-side rendering to avoid prerendering errors
  if (typeof window === 'undefined') {
    return {
      player: null,
      currentTrack: null,
      play: () => Promise.resolve()
    }
  }

  if (!context) {
    return {
      player: null,
      currentTrack: null,
      play: () => Promise.resolve()
    }
  }
  return context
}