'use client'

import { useState, useEffect, useRef } from 'react'
import { useSpotify } from './spotify-context'
import { usePremiumRestrictions } from './use-premium-restrictions'

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: any
  }
}

interface SpotifyPlayerState {
  deviceId: string | null
  isReady: boolean
  isPlaying: boolean
  currentTrack: any
  position: number
  duration: number
  volume: number
  isMaster: boolean
  skipLimitReached: boolean
  remainingSkips: number
  isPreviewMode: boolean
  previewTimeLeft: number
}

const STORAGE_KEY = 'spotify-player-state'
const EXPIRY_HOURS = 24

function savePlayerState(state: { currentTrack: any, position: number, volume: number, isPlaying: boolean }) {
  const data = {
    ...state,
    timestamp: Date.now()
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function loadPlayerState(): { currentTrack: any, position: number, volume: number, isPlaying: boolean } | null {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) return null
  const parsed = JSON.parse(data)
  const now = Date.now()
  const expiry = EXPIRY_HOURS * 60 * 60 * 1000
  if (now - parsed.timestamp > expiry) {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
  return {
    currentTrack: parsed.currentTrack,
    position: parsed.position,
    volume: parsed.volume,
    isPlaying: parsed.isPlaying
  }
}

export function useSpotifyPlayer() {
  const { accessToken, isAuthenticated, isAvailable, refreshToken, logout } = useSpotify()
  const { skipLimitReached, remainingSkips, incrementSkip } = usePremiumRestrictions()
  console.log('[USE SPOTIFY PLAYER] Hook inicializado - accessToken:', accessToken ? 'presente' : 'ausente', 'isAuthenticated:', isAuthenticated, 'isAvailable:', isAvailable)
  const [player, setPlayer] = useState<any>(null)
  const [playerState, setPlayerState] = useState<SpotifyPlayerState>({
    deviceId: null,
    isReady: false,
    isPlaying: false,
    currentTrack: null,
    position: 0,
    duration: 0,
    volume: 0.5,
    isMaster: false,
    skipLimitReached: false,
    remainingSkips: 6,
    isPreviewMode: true,
    previewTimeLeft: 30
  })
  const playerRef = useRef<any>(null)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const tabId = crypto.randomUUID()
  const [isMaster, setIsMaster] = useState(false)
  const masterCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Sincronizar estados del hook de restricciones
  useEffect(() => {
    setPlayerState(prev => ({ ...prev, skipLimitReached, remainingSkips }))
  }, [skipLimitReached, remainingSkips])

  // Temporizador de preview para usuarios no premium
  useEffect(() => {
    if (playerState.isPlaying && playerState.isPreviewMode && playerState.previewTimeLeft > 0) {
      const interval = setInterval(() => {
        setPlayerState(prev => ({ ...prev, previewTimeLeft: prev.previewTimeLeft - 1 }))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [playerState.isPlaying, playerState.isPreviewMode, playerState.previewTimeLeft])

  // Pausar cuando el tiempo de preview se agota
  useEffect(() => {
    if (playerState.previewTimeLeft === 0 && playerState.isPreviewMode && player) {
      player.pause().catch(console.error)
    }
  }, [playerState.previewTimeLeft, playerState.isPreviewMode, player])

  function tryBecomeMaster() {
    const currentMaster = localStorage.getItem('spotify-master-tab')
    if (!currentMaster) {
      localStorage.setItem('spotify-master-tab', JSON.stringify({ tabId, timestamp: Date.now() }))
      setIsMaster(true)
      return true
    }
    const parsed = JSON.parse(currentMaster)
    if (parsed.tabId === tabId) {
      setIsMaster(true)
      return true
    }
    if (Date.now() - parsed.timestamp > 10000) {
      localStorage.setItem('spotify-master-tab', JSON.stringify({ tabId, timestamp: Date.now() }))
      setIsMaster(true)
      return true
    }
    setIsMaster(false)
    return false
  }

  function checkMaster() {
    const currentMaster = localStorage.getItem('spotify-master-tab')
    if (!currentMaster) {
      tryBecomeMaster()
      return
    }
    const parsed = JSON.parse(currentMaster)
    if (parsed.tabId === tabId) {
      setIsMaster(true)
    } else {
      setIsMaster(false)
    }
  }

  useEffect(() => {
    if (!isAvailable || !isAuthenticated || !accessToken) return

    if (!tryBecomeMaster()) return

    // Prevent multiple initializations
    if (playerRef.current) {
      console.log('Player already initialized, skipping...')
      return
    }

    // Load Spotify SDK if not already loaded
    if (!window.Spotify) {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.body.appendChild(script)

      window.onSpotifyWebPlaybackSDKReady = () => {
        initializePlayer()
      }
    } else {
      initializePlayer()
    }

    function initializePlayer() {
      console.log('Initializing Spotify player...')
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Novo Desktop Player',
        getOAuthToken: async (cb: (token: string) => void) => {
          if (accessToken) {
            cb(accessToken)
          } else {
            console.log('No access token available, attempting to refresh...')
            try {
              const newToken = await refreshToken()
              cb(newToken)
            } catch (error) {
              console.error('Failed to refresh token in getOAuthToken:', error)
              cb('')
            }
          }
        },
        volume: 0.5,
        robustness: 'RETRY'
      })

      // Add listeners
      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player ready with Device ID', device_id)
        setPlayerState(prev => ({ ...prev, deviceId: device_id, isReady: true }))

        // Restaurar estado guardado
        const savedState = loadPlayerState()
        if (savedState) {
          // Restaurar volume
          if (savedState.volume !== undefined) {
            spotifyPlayer.setVolume(savedState.volume).catch(console.error)
          }
          // Restaurar track y position si disponible
          if (savedState.currentTrack && savedState.currentTrack.uri) {
            spotifyPlayer.play({ uris: [savedState.currentTrack.uri] }).then(() => {
              if (savedState.position > 0) {
                spotifyPlayer.seek(savedState.position).catch(console.error)
              }
            }).catch(console.error)
          } else if (savedState.isPlaying) {
            // Si estaba playing pero no hay track específica, resume
            spotifyPlayer.resume().catch(console.error)
          }
        }
      })

      spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device ID has gone offline', device_id)
        setPlayerState(prev => ({ ...prev, isReady: false }))
      })

      spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('Failed to initialize Spotify player:', message)
        setPlayerState(prev => ({ ...prev, isReady: false }))
      })

      spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('Spotify authentication error:', message)
        logout()
      })

      spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
        console.error('Spotify account error:', message)
        setPlayerState(prev => ({ ...prev, isReady: false }))
      })

      spotifyPlayer.addListener('player_state_changed', (state: any) => {
        console.log('[USE SPOTIFY PLAYER] player_state_changed fired:', state)
        if (!state) return

        const newState = {
          isPlaying: !state.paused,
          currentTrack: state.track_window.current_track,
          position: state.position,
          duration: state.duration,
          volume: state.volume || playerState.volume
        }

        setPlayerState(prev => ({
          ...prev,
          ...newState,
          previewTimeLeft: newState.currentTrack && (!prev.currentTrack || newState.currentTrack.id !== prev.currentTrack.id) ? 30 : prev.previewTimeLeft
        }))

        // Guardar estado en localStorage
        savePlayerState({
          currentTrack: newState.currentTrack,
          position: newState.position,
          volume: newState.volume,
          isPlaying: newState.isPlaying
        })

        // Enviar a otras tabs
        broadcastChannelRef.current?.postMessage({
          type: 'state-update',
          data: newState
        })

        console.log('[USE SPOTIFY PLAYER] playerState actualizado:', newState)
      })

      spotifyPlayer.connect().then((success: boolean) => {
        if (success) {
          console.log('Spotify player connected successfully')
        } else {
          console.error('Failed to connect Spotify player')
          setPlayerState(prev => ({ ...prev, isReady: false }))
        }
      }).catch((error: any) => {
        console.error('Error connecting Spotify player:', error)
        setPlayerState(prev => ({ ...prev, isReady: false }))
      })

      setPlayer(spotifyPlayer)
      playerRef.current = spotifyPlayer

      // Inicializar BroadcastChannel para sincronización entre tabs
      broadcastChannelRef.current = new BroadcastChannel('spotify-player-sync')
      broadcastChannelRef.current.onmessage = (event) => {
        const { type, data } = event.data
        if (type === 'state-update') {
          setPlayerState(prev => ({ ...prev, ...data }))
        }
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect()
        playerRef.current = null
      }
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close()
        broadcastChannelRef.current = null
      }
    }
  }, [accessToken, isAuthenticated, refreshToken])

  useEffect(() => {
    if (isMaster) {
      const pingInterval = setInterval(() => {
        broadcastChannelRef.current?.postMessage({ type: 'master-ping' })
      }, 2000)
      return () => clearInterval(pingInterval)
    }
  }, [isMaster])

  const play = async (uri?: string) => {
    console.log('play called, player:', player, 'playerState.isReady:', playerState.isReady)
    if (!player) {
      console.log('No player available')
      return
    }

    try {
      if (uri) {
        await player.play({ uris: [uri] })
      } else {
        await player.resume()
      }
      console.log('Track played successfully')
    } catch (error: any) {
      console.error('Error playing track:', error)
      if (error.status === 403 || error.message?.includes('403')) {
        console.log('403 error detected, attempting token refresh and retry...')
        try {
          await refreshToken()
          // Retry after refresh
          if (uri) {
            await player.play({ uris: [uri] })
          } else {
            await player.resume()
          }
          console.log('Track played successfully after retry')
        } catch (retryError) {
          console.error('Failed to play track after retry:', retryError)
          logout() // Force re-authentication if retry fails
        }
      }
    }
  }

  const pause = async () => {
    if (!player) return
    try {
      await player.pause()
      console.log('Track paused successfully')
    } catch (error: any) {
      console.error('Error pausing track:', error)
      if (error.status === 403 || error.message?.includes('403')) {
        console.log('403 error detected, attempting token refresh...')
        try {
          await refreshToken()
          await player.pause()
          console.log('Track paused successfully after retry')
        } catch (retryError) {
          console.error('Failed to pause track after retry:', retryError)
          logout() // Force re-authentication if retry fails
        }
      }
    }
  }

  const nextTrack = async () => {
    if (!player) return
    if (skipLimitReached) {
      console.error('Skip limit reached for non-premium user')
      return
    }
    incrementSkip()
    try {
      await player.nextTrack()
      console.log('Next track played successfully')
    } catch (error: any) {
      console.error('Error playing next track:', error)
      if (error.status === 403 || error.message?.includes('403')) {
        console.log('403 error detected, attempting token refresh...')
        try {
          await refreshToken()
          await player.nextTrack()
          console.log('Next track played successfully after retry')
        } catch (retryError) {
          console.error('Failed to play next track after retry:', retryError)
          logout() // Force re-authentication if retry fails
        }
      }
    }
  }

  const previousTrack = async () => {
    if (!player) return
    if (skipLimitReached) {
      console.error('Skip limit reached for non-premium user')
      return
    }
    incrementSkip()
    try {
      await player.previousTrack()
      console.log('Previous track played successfully')
    } catch (error: any) {
      console.error('Error playing previous track:', error)
      if (error.status === 403 || error.message?.includes('403')) {
        console.log('403 error detected, attempting token refresh...')
        try {
          await refreshToken()
          await player.previousTrack()
          console.log('Previous track played successfully after retry')
        } catch (retryError) {
          console.error('Failed to play previous track after retry:', retryError)
          logout() // Force re-authentication if retry fails
        }
      }
    }
  }

  const seek = async (position: number) => {
    if (!player) return
    try {
      await player.seek(position)
      console.log('Seek performed successfully')
    } catch (error: any) {
      console.error('Error seeking:', error)
      if (error.status === 403 || error.message?.includes('403')) {
        console.log('403 error detected, attempting token refresh...')
        try {
          await refreshToken()
          await player.seek(position)
          console.log('Seek performed successfully after retry')
        } catch (retryError) {
          console.error('Failed to seek after retry:', retryError)
          logout() // Force re-authentication if retry fails
        }
      }
    }
  }

  const setVolume = async (volume: number) => {
    if (!player) return
    try {
      await player.setVolume(volume)
      setPlayerState(prev => ({ ...prev, volume }))
      console.log('Volume set successfully')
    } catch (error: any) {
      console.error('Error setting volume:', error)
      if (error.status === 403 || error.message?.includes('403')) {
        console.log('403 error detected, attempting token refresh...')
        try {
          await refreshToken()
          await player.setVolume(volume)
          setPlayerState(prev => ({ ...prev, volume }))
          console.log('Volume set successfully after retry')
        } catch (retryError) {
          console.error('Failed to set volume after retry:', retryError)
          logout() // Force re-authentication if retry fails
        }
      }
    }
  }

  const playPlaylist = async (playlistId: string) => {
    console.log('playPlaylist called, player:', player, 'playerState.isReady:', playerState.isReady)
    if (!player) {
      console.log('No player available, waiting...')
      // Wait for player to be available (simple polling approach)
      let attempts = 0
      while (!player && attempts < 50) { // Wait up to 5 seconds
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      if (!player) {
        console.error('Player failed to become available within timeout')
        return
      }
    }

    if (!playerState.isReady) {
      console.log('Player not ready, waiting...')
      // Wait for player to be ready (simple polling approach)
      let attempts = 0
      while (!playerState.isReady && attempts < 50) { // Wait up to 5 seconds
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      if (!playerState.isReady) {
        console.error('Player failed to become ready within timeout')
        return
      }
    }

    try {
      await player.play({ context_uri: `spotify:playlist:${playlistId}` })
      console.log('Playlist played successfully')
    } catch (error: any) {
      console.error('Error playing playlist:', error)
      if (error.status === 403 || error.message?.includes('403')) {
        console.log('403 error detected, attempting token refresh and retry...')
        try {
          await refreshToken()
          // Retry after refresh
          await player.play({ context_uri: `spotify:playlist:${playlistId}` })
          console.log('Playlist played successfully after retry')
        } catch (retryError) {
          console.error('Failed to play playlist after retry:', retryError)
          logout() // Force re-authentication if retry fails
        }
      }
    }
  }

  return {
    player,
    playerState,
    play,
    pause,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    playPlaylist,
    isAvailable
  }
}