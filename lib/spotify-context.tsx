'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface SpotifyContextType {
  accessToken: string | null
  isAuthenticated: boolean
  login: () => void
  logout: () => void
  refreshToken: () => Promise<void>
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined)

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check for existing token in cookies/localStorage
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/spotify/token')
        if (response.ok) {
          const data = await response.json()
          setAccessToken(data.access_token)
          setIsAuthenticated(true)
        }
      } catch (error) {
        console.error('Failed to check auth:', error)
      }
    }

    checkAuth()
  }, [])

  const login = () => {
    window.location.href = '/api/spotify/auth'
  }

  const logout = () => {
    setAccessToken(null)
    setIsAuthenticated(false)
    // Clear cookies
    document.cookie = 'spotify_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'spotify_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }

  const refreshToken = async () => {
    try {
      const response = await fetch('/api/spotify/refresh', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        setAccessToken(data.access_token)
        setIsAuthenticated(true)
      } else {
        logout()
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
      logout()
    }
  }

  return (
    <SpotifyContext.Provider value={{
      accessToken,
      isAuthenticated,
      login,
      logout,
      refreshToken
    }}>
      {children}
    </SpotifyContext.Provider>
  )
}

export function useSpotify() {
  const context = useContext(SpotifyContext)
  if (context === undefined) {
    throw new Error('useSpotify must be used within a SpotifyProvider')
  }
  return context
}