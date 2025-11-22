'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: any
  }
}

export function useSpotifyPlayer(accessToken: string | null) {
  const [player, setPlayer] = useState<any>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (!scriptLoaded.current) {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true

      window.onSpotifyWebPlaybackSDKReady = () => {
        const spotifyPlayer = new window.Spotify.Player({
          name: 'Novo Music Player',
          getOAuthToken: (cb: (token: string) => void) => {
            if (accessToken) cb(accessToken)
          },
          volume: 0.5
        })

        // Error handling
        spotifyPlayer.addListener('initialization_error', ({ message }: any) => {
          console.error('Failed to initialize:', message)
        })

        spotifyPlayer.addListener('authentication_error', ({ message }: any) => {
          console.error('Failed to authenticate:', message)
        })

        spotifyPlayer.addListener('account_error', ({ message }: any) => {
          console.error('Failed to validate Spotify account:', message)
        })

        spotifyPlayer.addListener('playback_error', ({ message }: any) => {
          console.error('Failed to perform playback:', message)
        })

        // Playback status updates
        spotifyPlayer.addListener('player_state_changed', (state: any) => {
          if (!state) return
          // Handle state changes
        })

        // Ready
        spotifyPlayer.addListener('ready', ({ device_id }: any) => {
          console.log('Ready with Device ID', device_id)
          setDeviceId(device_id)
          setIsReady(true)
        })

        // Not Ready
        spotifyPlayer.addListener('not_ready', ({ device_id }: any) => {
          console.log('Device ID has gone offline', device_id)
          setIsReady(false)
        })

        spotifyPlayer.connect()
        setPlayer(spotifyPlayer)
      }

      document.body.appendChild(script)
      scriptLoaded.current = true
    }

    return () => {
      if (player) {
        player.disconnect()
      }
    }
  }, [accessToken])

  const playTrack = async (spotifyUri: string) => {
    if (!deviceId || !accessToken) return

    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [spotifyUri] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      })
    } catch (error) {
      console.error('Failed to play track:', error)
    }
  }

  const pause = () => {
    if (player) player.pause()
  }

  const resume = () => {
    if (player) player.resume()
  }

  const nextTrack = () => {
    if (player) player.nextTrack()
  }

  const previousTrack = () => {
    if (player) player.previousTrack()
  }

  return {
    player,
    deviceId,
    isReady,
    playTrack,
    pause,
    resume,
    nextTrack,
    previousTrack
  }
}