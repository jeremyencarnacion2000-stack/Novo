'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface SpotifyContextType {
  accessToken: string | null
  isAuthenticated: boolean
  login: () => void
  logout: () => void
  refreshToken: () => Promise<string>
  isAvailable: boolean
  isPremium: boolean
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined)

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isPremium, setIsPremium] = useState(false)

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const profile = await response.json()
        setIsPremium(profile.product === 'premium')
        console.log('User profile fetched, premium:', profile.product === 'premium')
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
    }
  }

  useEffect(() => {
    // Check for existing token in cookies/localStorage
    const checkAuth = async () => {
      console.log('DEBUG: Checking Spotify authentication on page load')
      try {
        const response = await fetch('/api/spotify/token')
        console.log('DEBUG: Token check response status:', response.status)
        if (response.ok) {
          const data = await response.json()
          console.log('DEBUG: Token data received:', data.access_token ? 'present' : 'missing')
          setAccessToken(data.access_token)
          setIsAuthenticated(true)
          console.log('Spotify auth check successful')
          // Fetch user profile to check premium status
          fetchUserProfile(data.access_token)
        } else {
          console.log('Spotify auth check failed:', response.status)
          // Attempt to refresh token if check fails
          console.log('DEBUG: Attempting to refresh token after failed check')
          try {
            const refreshResponse = await fetch('/api/spotify/refresh', { method: 'POST' })
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              console.log('DEBUG: Token refreshed successfully after failed check')
              setAccessToken(refreshData.access_token)
              setIsAuthenticated(true)
              fetchUserProfile(refreshData.access_token)
            } else {
              console.log('DEBUG: Token refresh failed after failed check:', refreshResponse.status)
              setIsAuthenticated(false)
              setAccessToken(null)
            }
          } catch (refreshError) {
            console.error('DEBUG: Error refreshing token after failed check:', refreshError)
            setIsAuthenticated(false)
            setAccessToken(null)
          }
        }
      } catch (error) {
        console.error('Failed to check auth:', error)
        setIsAuthenticated(false)
        setAccessToken(null)
      }
    }

    checkAuth()
  }, [])

  const login = () => {
    console.log('Redirecting to Spotify auth endpoint');
    window.location.href = '/api/spotify/auth'
  }

  const logout = () => {
    setAccessToken(null)
    setIsAuthenticated(false)
    setIsPremium(false)
    // Clear cookies
    document.cookie = 'spotify_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'spotify_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }

  const refreshToken = async (): Promise<string> => {
    try {
      console.log('Attempting to refresh Spotify token')
      const response = await fetch('/api/spotify/refresh', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        setAccessToken(data.access_token)
        setIsAuthenticated(true)
        console.log('Spotify token refreshed successfully')
        fetchUserProfile(data.access_token)
        return data.access_token
      } else {
        console.log('Failed to refresh Spotify token:', response.status)
        logout()
        throw new Error('Failed to refresh token')
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
      logout()
      throw error
    }
  }

  return (
    <SpotifyContext.Provider value={{
      accessToken,
      isAuthenticated,
      login,
      logout,
      refreshToken,
      isAvailable: true,
      isPremium
    }}>
      {children}
    </SpotifyContext.Provider>
  )
}

export function useSpotify() {
  const context = useContext(SpotifyContext)
  if (!context) {
    return {
      accessToken: null,
      isAuthenticated: false,
      login: () => {},
      logout: () => {},
      refreshToken: async (): Promise<string> => '',
      isAvailable: false,
      isPremium: false
    }
  }
  return context
}