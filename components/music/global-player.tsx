'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { usePlayerStore } from '@/lib/player-store'
import { useToast } from '@/components/ui/use-toast'

interface GlobalPlayerProps {
  children: ReactNode
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export function GlobalPlayer({ children }: GlobalPlayerProps) {
  const playerRef = useRef<any>(null)
  const apiLoadedRef = useRef(false)
  
  const {
    currentTrack,
    isPlaying,
    volume,
    nextTrack,
    setProgress,
    setReady,
    isReady
  } = usePlayerStore()

  const { toast } = useToast()

  // Refs to prevent redundant triggers
  const lastProcessedTrackId = useRef<string | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const consecutiveErrors = useRef<number>(0)

  // ─── Mobile detection (pointer coarse = touch device) ────────────────────
  // On mobile, we NEVER auto-load the YouTube script reactively.
  // It must come from a real onClick event dispatched via 'youtube:load-api'.
  const isMobile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1

  // ─── Facade: Core API loader — called only on demand ───────────────────────
  function loadYouTubeAPI() {
    if (apiLoadedRef.current) return
    apiLoadedRef.current = true

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player-container', {
        height: '1',
        width: '1',
        videoId: '',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '*'
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      })
    }

    // If the YT API was already injected (e.g. hot reload), initialize immediately
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady()
      return
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.async = true
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
  }

  // ─── 1. Deferred initialization: strictly event-driven ────────────────────
  // The ONLY allowed trigger is the 'youtube:load-api' CustomEvent, which is
  // dispatched exclusively from real onClick handlers in ContextHub.
  // NO passive listeners (scroll, pointermove, touchstart) are used.
  useEffect(() => {
    const handleLoadRequest = () => loadYouTubeAPI()
    window.addEventListener('youtube:load-api', handleLoadRequest)

    return () => {
      window.removeEventListener('youtube:load-api', handleLoadRequest)
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Auto-load only on DESKTOP when a track is selected programmatically ──
  // On mobile (isMobile=true), we skip this reactive trigger entirely to
  // prevent main-thread injection during hydration.
  useEffect(() => {
    if (!isMobile && currentTrack?.id) {
      loadYouTubeAPI()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id])

  function onPlayerReady(event: any) {
    console.log('YouTube Player Ready')
    setReady(true)
    event.target.setVolume(volume * 100)
    
    // Start syncing progress
    startProgressSync()
  }

  function startProgressSync() {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    syncIntervalRef.current = setInterval(() => {
      const currentTime = playerRef.current?.getCurrentTime?.()
      if (currentTime > 0) setProgress(Math.floor(currentTime * 1000))
    }, 1000)
  }

  function stopProgressSync() {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current)
      syncIntervalRef.current = null
    }
  }

  function onPlayerStateChange(event: any) {
    const YT_STATE_PLAYING = 1
    const YT_STATE_PAUSED = 2
    const YT_STATE_ENDED = 0

    if (event.data === YT_STATE_ENDED) {
       console.log('GlobalPlayer: Track ended natively in YT player.')
       const state = usePlayerStore.getState()
       
       if (state.currentTrack && state.currentTrack.id !== lastProcessedTrackId.current) {
         lastProcessedTrackId.current = state.currentTrack.id
         
         // Notify user
         toast({
           title: "Autoplay",
           description: `Playing next...`,
           duration: 3000,
         });

         nextTrack()
       }
    }
  }

  function onPlayerError(event: any) {
    console.error('YouTube Player Error:', event.data)
    consecutiveErrors.current += 1
    
    if (consecutiveErrors.current >= 3) {
      toast({
        title: "Error de reproducción",
        description: "Demasiados errores de reproducción consecutivos. Se detuvo para evitar bucles.",
        variant: "destructive"
      })
      usePlayerStore.getState().togglePlayPause() // Stop playing
      consecutiveErrors.current = 0
      return
    }

    toast({
        title: "Playback Error",
        description: "This track could not be played. Skipping to next.",
        variant: "destructive"
    })
    nextTrack()
  }

  // 2. Playback Control: Reacting to ZUSTAND changes
  useEffect(() => {
    // Crucial: Only proceed if player is initialized and methods exist
    if (!playerRef.current || !isReady || typeof playerRef.current.loadVideoById !== 'function') {
        return;
    }

    if (currentTrack?.id) {
        // Safe check for getVideoData which might not be ready yet
        let currentlyLoadedVideoId = '';
        try {
            if (typeof playerRef.current.getVideoData === 'function') {
                currentlyLoadedVideoId = playerRef.current.getVideoData()?.video_id;
            }
        } catch (e) {
            // Method might be unavailable early in hydration
        }
        
        // If the video ID changed, we need to load the new video
        if (currentTrack.id !== currentlyLoadedVideoId) {
            console.log(`GlobalPlayer: Loading new video ID: ${currentTrack.id}`)
            consecutiveErrors.current = 0 // Reset error count when starting a new track
            if (typeof playerRef.current.loadVideoById === 'function') {
                playerRef.current.loadVideoById(currentTrack.id)
            }
            lastProcessedTrackId.current = null // Reset block
            
            // We don't need to manually call playVideo if loadVideoById is used 
            // but we'll ensure the state is synced
            if (!isPlaying) {
              playerRef.current.pauseVideo();
            }

            // Persistence: Record History
            fetch('/api/music/history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trackId: currentTrack.id,
                title: currentTrack.name,
                artist: currentTrack.artist,
                artistId: currentTrack.artistId || '',
                thumbnail: currentTrack.image,
              })
            }).catch(err => console.error('Failed to record history:', err));
        } else {
            // Video is already loaded, handle play/pause sync
            const playerState = playerRef.current.getPlayerState?.();
            const YT_PLAYING = 1;
            const YT_PAUSED = 2;

            if (isPlaying && playerState !== YT_PLAYING) {
                playerRef.current.playVideo?.();
                startProgressSync()
            } else if (!isPlaying && playerState === YT_PLAYING) {
                playerRef.current.pauseVideo?.();
                stopProgressSync()
            }
        }
    } else {
        if (typeof playerRef.current.stopVideo === 'function') {
            playerRef.current.stopVideo()
        }
    }
  }, [currentTrack?.id, isPlaying, isReady])

  // 3. Volume control
  useEffect(() => {
    if (!playerRef.current || !isReady) return
    // YT volume is 0-100
    if (typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(Math.floor(volume * 100))
    }
  }, [volume, isReady])

  // 4. Seek Control (TODO: Need a separate signal in Zustand if we want explicit seeking vs polling progress)
  // For now, seeking is handled by updating progress in the store. We'd need an event channel to tell this component "Seek now".

  return (
    <>
      <div 
        id="youtube-player-container" 
        className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none -z-50 overflow-hidden" 
        aria-hidden="true"
      />
      {children}
    </>
  )
}