'use client'

import { useSpotifyPlayer } from '@/lib/use-spotify-player'
import { useSpotify } from '@/lib/spotify-context'
import { DashboardShell } from '@/components/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SpotifyAuthInvitation } from '@/components/music/spotify-auth-invitation'

export default function MusicPage() {
  const { playerState, play, pause, seek } = useSpotifyPlayer()
  const { accessToken, isAuthenticated, isPremium } = useSpotify()
  const [playlists, setPlaylists] = useState<any[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<any>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastSentIsPlaying = useRef<boolean | null>(null)
  const lastSentPosition = useRef<number | null>(null)

  const fetchPlaylists = async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setPlaylists(data.items)
        if (data.items.length > 0 && !selectedPlaylist) {
          setSelectedPlaylist(data.items[0])
        }
      }
    } catch (error) {
      console.error('Error fetching playlists:', error)
    } finally {
      setLoading(false)
    }
  }
  const fetchSearchResults = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        console.error('Search failed')
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchPlaylists()
    }
  }, [isAuthenticated, accessToken])

  useEffect(() => {
    const saved = localStorage.getItem('selectedPlaylist')
    if (saved) {
      setSelectedPlaylist(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    if (selectedPlaylist) {
      localStorage.setItem('selectedPlaylist', JSON.stringify(selectedPlaylist))
    }
  }, [selectedPlaylist])

  // URI por defecto si no hay reproducción activa
  const defaultPlaylistUri = 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M' // Today's Top Hits

  // Determinar la URI a usar
  const uri = !isAuthenticated ? defaultPlaylistUri : (selectedTrack ? `spotify:track:${selectedTrack.id}` : selectedPlaylist ? `spotify:playlist:${selectedPlaylist.id}` : playerState.currentTrack ? `spotify:track:${playerState.currentTrack.id}` : defaultPlaylistUri)
  console.log('[MUSIC PAGE] URI calculada:', uri, 'currentTrack:', playerState.currentTrack)

  // Construir la URL del embed
  const embedUrl = `https://open.spotify.com/embed/${uri.split(':')[1]}/${uri.split(':')[2]}?theme=0&autoplay=1`
  console.log('[MUSIC PAGE] Embed URL:', embedUrl)

  // Enviar comandos al iframe cuando cambie el estado del player
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return

    if (playerState.isPlaying !== lastSentIsPlaying.current) {
      const iframeWindow = iframeRef.current.contentWindow

      if (playerState.isPlaying) {
        console.log('[MUSIC PAGE] Enviando comando PLAY al iframe - playerState:', playerState)
        iframeWindow.postMessage({ method: 'play' }, '*')
      } else {
        console.log('[MUSIC PAGE] Enviando comando PAUSE al iframe - playerState:', playerState)
        iframeWindow.postMessage({ method: 'pause' }, '*')
      }
      lastSentIsPlaying.current = playerState.isPlaying
    }
  }, [playerState.isPlaying])

  // Enviar seek al iframe cuando cambie la posición
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return

    if (Math.abs(playerState.position - (lastSentPosition.current || 0)) > 1000) {
      console.log('[MUSIC PAGE] Enviando comando SEEK al iframe - position:', playerState.position)
      const iframeWindow = iframeRef.current.contentWindow
      iframeWindow.postMessage({ method: 'seek', value: playerState.position }, '*')
      lastSentPosition.current = playerState.position
    }
  }, [playerState.position])

  // Escuchar eventos del iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('[MUSIC PAGE] Mensaje recibido del iframe:', event.data, 'origin:', event.origin)

      // Solo aceptar mensajes de Spotify
      if (event.origin !== 'https://open.spotify.com') return

      const { type, payload } = event.data

      switch (type) {
        case 'ready':
          console.log('[MUSIC PAGE] Spotify embed ready')
          break
        case 'playback_update':
          console.log('[MUSIC PAGE] Playback update from embed - payload:', payload, 'playerState:', playerState)
          // Si el embed está reproduciendo y el SDK no, sincronizar
          if (payload && !payload.isPaused && !playerState.isPlaying) {
            console.log('[MUSIC PAGE] Sincronizando: embed playing, SDK not playing - llamando play()')
            play()
          }
          // Si el embed está pausado y el SDK está reproduciendo, sincronizar
          else if (payload && payload.isPaused && playerState.isPlaying) {
            console.log('[MUSIC PAGE] Sincronizando: embed paused, SDK playing - llamando pause()')
            pause()
          }
          // Sincronizar posición si hay diferencia significativa
          if (payload && Math.abs(payload.position - playerState.position) > 1000) {
            console.log('[MUSIC PAGE] Sincronizando posición: embed', payload.position, 'SDK', playerState.position)
            seek(payload.position)
          }
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [playerState.isPlaying, playerState.position, play, pause, seek])

  return (
    <DashboardShell>
      <div className="space-y-6 h-full">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Music</h1>
          <Button onClick={() => window.open('https://open.spotify.com', '_blank')} variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Spotify
          </Button>
        </div>
        {!isAuthenticated && <SpotifyAuthInvitation />}
        {isAuthenticated && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Search Songs</h2>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="Search for songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchSearchResults()}
              />
              <Button onClick={fetchSearchResults} disabled={searchLoading}>
                {searchLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Results</h3>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {searchResults.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        setSelectedTrack(track)
                        setSelectedPlaylist(null)
                      }}
                      className="w-full text-left p-2 rounded hover:bg-gray-100 flex items-center space-x-3"
                    >
                      <img src={track.album.images[0]?.url} alt={track.name} className="w-10 h-10 rounded" />
                      <div>
                        <p className="font-medium">{track.name}</p>
                        <p className="text-sm text-gray-600">{track.artists.map(a => a.name).join(', ')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {isAuthenticated && (
          <>
            {loading && <p>Loading playlists...</p>}
            {playlists.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Your Playlists</h2>
                <div className="flex space-x-4 overflow-x-auto pb-4">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => setSelectedPlaylist(playlist)}
                      className={`flex-shrink-0 p-4 rounded-lg border transition-colors ${
                        selectedPlaylist?.id === playlist.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <img src={playlist.images[0]?.url} alt={playlist.name} className="w-20 h-20 rounded mb-2" />
                      <p className="text-sm font-medium truncate w-20">{playlist.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {!isPremium && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              Nota: Como no tienes Spotify Premium, solo puedes escuchar previews de 30 segundos por canción.
            </p>
          </div>
        )}
        <div className="flex-1 min-h-0">
          {!isAuthenticated && (
            <h2 className="text-xl font-semibold mb-4">Explora tendencias musicales mientras tanto</h2>
          )}
          <iframe
            ref={iframeRef}
            src={embedUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-lg"
            style={{ minHeight: isAuthenticated ? '600px' : '400px' }}
          ></iframe>
        </div>
      </div>
    </DashboardShell>
  )
}