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
          setSpotifyToken(data.accessToken)
          usePlayerStore.getState().setAccessToken(data.accessToken)
        } else {
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
        getOAuthToken: (cb: (token: string) => void) => {
          cb(tokenRef.current || '')
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

        if (state.paused && state.position === 0 && state.duration > 0) {
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

    // Use Spotify Web API to play the track on our device
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${spotifyToken}`
      },
      body: JSON.stringify({
        uris: [currentTrack.uri]
      })
    }).catch(error => {
      console.error('Error playing track:', error)
    })
  }, [currentTrack?.id, spotifyToken, isPremium])

  return <>{children}</>
}