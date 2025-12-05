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
  const {
    setDeviceId,
    setReady,
    currentTrack,
    isPlaying,
    volume,
    nextTrack,
    setProgress,
  } = usePlayerStore()

  // Check if user has Premium account
  useEffect(() => {
    async function checkPremium() {
      try {
        const response = await fetch('/api/spotify/has-token')
        const data = await response.json()
        console.log('Premium status check:', data)
        setIsPremium(data.isPremium || false)
      } catch (error) {
        console.log('Error checking premium status:', error)
        setIsPremium(false)
      }
    }
    if (session?.accessToken) {
      checkPremium()
    }
  }, [session?.accessToken])

  useEffect(() => {
    // Only load SDK for Premium users
    if (!session?.accessToken || !isPremium) {
      console.log('Skipping Spotify SDK - Premium required or no session')
      return
    }

    console.log('Loading Spotify Web Playback SDK for Premium user')

    // Load Spotify Web Playback SDK
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Novo Music Player',
        getOAuthToken: (cb: (token: string) => void) => {
          if (session?.accessToken) {
            cb(session.accessToken)
          }
        },
        volume: volume
      })

      // Error handling
      player.addListener('initialization_error', ({ message }: any) => {
        console.error('Spotify initialization error:', message)
      })
      player.addListener('authentication_error', ({ message }: any) => {
        console.error('Spotify authentication error:', message)
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

      // Not Ready
      player.addListener('not_ready', ({ device_id }: any) => {
        console.log('Device ID has gone offline', device_id)
        setReady(false)
      })

      // Player state changed
      player.addListener('player_state_changed', (state: any) => {
        if (!state) return

        // Update progress
        setProgress(state.position)

        // Auto-play next track when current track ends
        if (state.paused && state.position === 0 && state.duration > 0) {
          console.log('Track ended, playing next...')
          nextTrack()
        }
      })

      // Connect to the player
      player.connect().then((success: boolean) => {
        if (success) {
          console.log('Spotify Player connected successfully')
        }
      })

      playerRef.current = player
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect()
      }
    }
  }, [session?.accessToken, isPremium])

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
    if (!playerRef.current || !currentTrack || !session?.accessToken || !isPremium) return

    const deviceId = usePlayerStore.getState().deviceId
    if (!deviceId) return

    // Use Spotify Web API to play the track on our device
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({
        uris: [currentTrack.uri]
      })
    }).catch(error => {
      console.error('Error playing track:', error)
    })
  }, [currentTrack?.id, session?.accessToken, isPremium])

  return <>{children}</>
}