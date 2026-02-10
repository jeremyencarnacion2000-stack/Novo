'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePlayerStore } from '@/lib/player-store'

interface GlobalPlayerProps {
  children: ReactNode
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

export function GlobalPlayer({ children }: GlobalPlayerProps) {
  const { data: session } = useSession()
  const playerRef = useRef<any>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null)
  const {
    setDeviceId,
    setReady,
    currentTrack,
    isPlaying,
    volume,
    nextTrack,
    setProgress,
  } = usePlayerStore()

  // Check if user has Premium account and get the correct token
  useEffect(() => {
    async function checkPremium() {
      try {
        const response = await fetch('/api/spotify/has-token')
        const data = await response.json()
        setIsPremium(data.isPremium || false)
        if (data.hasToken && data.accessToken) {
          console.log('GlobalPlayer: Spotify Token Found. Premium:', data.isPremium, 'Product:', data.product)
          setSpotifyToken(data.accessToken)
          usePlayerStore.getState().setAccessToken(data.accessToken)
        } else {
          console.log('GlobalPlayer: No Spotify Token found')
          setSpotifyToken(null)
        }
      } catch (error) {
        setIsPremium(false)
        setSpotifyToken(null)
      }
    }

    // We check premium if we have ANY session, because we might have a Spotify cookie
    if (session) {
      checkPremium()
    }
  }, [session])

  // Ref to hold the latest token to avoid closure staleness
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    tokenRef.current = spotifyToken
  }, [spotifyToken])

  useEffect(() => {
    // Only load SDK if we have a verified Spotify token AND user is Premium
    if (!spotifyToken || !isPremium) {
      if (playerRef.current) {
        console.log('Disconnecting Spotify SDK because user is not Premium or token is missing')
        playerRef.current.disconnect()
        playerRef.current = null
        setReady(false)
        setDeviceId('')
      }

      // Also remove the script tag if it exists
      const script = document.getElementById('spotify-player-sdk')
      if (script) {
        console.log('Removing Spotify SDK script for Free user')
        script.remove()
      }

      // Clear the global ready callback
      window.onSpotifyWebPlaybackSDKReady = () => { }

      return
    }

    // Load Spotify Web Playback SDK
    if (!window.Spotify) {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      script.id = 'spotify-player-sdk'
      if (!document.getElementById('spotify-player-sdk')) {
        document.body.appendChild(script)
      }
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Novo Music Player',
        getOAuthToken: async (cb: (token: string) => void) => {
          // Fetch a fresh token when the SDK requests it
          try {
            const response = await fetch('/api/spotify/has-token')
            const data = await response.json()
            if (data.hasToken && data.accessToken) {
              console.log('Refreshing Spotify token for SDK...')
              cb(data.accessToken)
              // Update local state as well
              setSpotifyToken(data.accessToken)
              usePlayerStore.getState().setAccessToken(data.accessToken)
            } else {
              console.warn('Failed to refresh Spotify token for SDK', data)
              cb(tokenRef.current || '')
            }
          } catch (error) {
            console.error('Error fetching fresh token for SDK:', error)
            cb(tokenRef.current || '')
          }
        },
        volume: volume
      })

      // Error handling
      player.addListener('initialization_error', ({ message }: any) => {
        console.error('Spotify initialization error:', message)
        setReady(false)
      })
      player.addListener('authentication_error', ({ message }: any) => {
        console.error('Spotify authentication error:', message)
        setReady(false)
      })
      player.addListener('account_error', ({ message }: any) => {
        console.error('Spotify account error:', message)
      })
      player.addListener('playback_error', ({ message }: any) => {
        console.error('Spotify playback error:', message)
      })

      // Ready
      player.addListener('ready', ({ device_id }: any) => {
        console.log('Spotify Player Ready with Device ID', device_id)
        setDeviceId(device_id)
        setReady(true)
      })

      player.addListener('not_ready', ({ device_id }: any) => {
        console.log('Spotify Player Not Ready', device_id)
        setReady(false)
      })

      // Player state changed
      player.addListener('player_state_changed', (state: any) => {
        if (!state) return

        // Update progress
        setProgress(state.position)

        // Lógica de Cambio Automático (Auto-play)
        const isTrackEnd = (state.paused && state.position === 0 && state.duration > 0) ||
          (state.paused && (state.position === 0 || state.position === state.duration) &&
            (!state.restrictions?.disallow_resuming_reasons || state.restrictions.disallow_resuming_reasons.length === 0));

        if (isTrackEnd) {
          console.log('GlobalPlayer: Fin de canción detectado. Pasando al siguiente track...')
          nextTrack()
        }
      })

      player.connect().then((success: boolean) => {
        if (success) {
          console.log('The Web Playback SDK successfully connected to Spotify!')
        }
      })

      playerRef.current = player
    }

    // If script is already loaded, manually trigger ready
    if (window.Spotify) {
      window.onSpotifyWebPlaybackSDKReady()
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect()
      }
    }
  }, [spotifyToken, isPremium])

  // Play/pause control (only for Premium)
  useEffect(() => {
    if (!playerRef.current || !isPremium) return

    if (isPlaying) {
      playerRef.current.resume()
    } else {
      playerRef.current.pause()
    }
  }, [isPlaying, isPremium])

  // Volume control (only for Premium)
  useEffect(() => {
    if (!playerRef.current || !isPremium) return
    playerRef.current.setVolume(volume)
  }, [volume, isPremium])

  // Play track when currentTrack changes (only for Premium)
  useEffect(() => {
    if (!playerRef.current || !currentTrack || !spotifyToken || !isPremium) return

    const deviceId = usePlayerStore.getState().deviceId
    if (!deviceId) return

    const playTrack = async (token: string) => {
      try {
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            uris: [currentTrack.uri]
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Spotify play error:', response.status, errorData)

          // If unauthorized or forbidden, try to refresh the token once
          if (response.status === 401 || response.status === 403) {
            console.log('Token might be stale or invalid, attempting to refresh...')
            const refreshRes = await fetch('/api/spotify/has-token')
            const data = await refreshRes.json()

            if (data.hasToken && data.accessToken && data.accessToken !== token) {
              setSpotifyToken(data.accessToken)
              usePlayerStore.getState().setAccessToken(data.accessToken)
              setIsPremium(data.isPremium)
              // The effect will re-run with the new token
            }
          }
        }
      } catch (error) {
        console.error('Error playing track:', error)
      }
    }

    playTrack(spotifyToken)
  }, [currentTrack?.id, spotifyToken, isPremium, usePlayerStore.getState().deviceId])

  // Timer-based auto-next for Free users
  useEffect(() => {
    if (isPremium) return

    console.log(`GlobalPlayer (Free): State Check - isPlaying: ${isPlaying}, Track: ${currentTrack?.name}, Duration: ${currentTrack?.duration_ms}ms`)

    if (!isPlaying || !currentTrack?.duration_ms) {
      console.log('GlobalPlayer (Free): Timer not started - isPlaying is false or duration is missing.')
      return
    }

    // Use full duration + buffer. 
    // Note: For real playlists, the embed handles audio transition internally, 
    // but this timer keeps our store/UI in sync.
    const BUFFER = 5000
    const triggerTime = currentTrack.duration_ms + BUFFER

    console.log(`GlobalPlayer (Free): Starting auto-next timer. Will trigger in ${triggerTime}ms`)

    const timer = setTimeout(() => {
      console.log('GlobalPlayer (Free): Timer reached! Triggering nextTrack().')
      nextTrack()
    }, triggerTime)

    return () => {
      console.log('GlobalPlayer (Free): Clearing auto-next timer (cleanup).')
      clearTimeout(timer)
    }
  }, [currentTrack?.id, isPlaying, isPremium, nextTrack])

  return <>{children}</>
}