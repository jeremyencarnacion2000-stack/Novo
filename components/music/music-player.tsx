'use client'

import { useState, useEffect } from 'react'
import { useSpotify } from '@/lib/spotify-context'
import { useSpotifyPlayer } from '@/lib/use-spotify-player'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, LogIn } from 'lucide-react'
import { FloatingMusicWidget } from './floating-music-widget'
import { Equalizer } from './equalizer'

interface Track {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string }[]
  }
  duration_ms: number
}

interface Playlist {
  id: string
  name: string
  images: { url: string }[]
  tracks: {
    total: number
  }
}

export function MusicPlayer() {
  const { accessToken, isAuthenticated, login } = useSpotify()
  const { playTrack, pause, resume, nextTrack: playerNextTrack, previousTrack: playerPreviousTrack, isReady } = useSpotifyPlayer(accessToken)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchPlaylists()
    }
  }, [isAuthenticated, accessToken])

  const fetchPlaylists = async () => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      const data = await response.json()
      setPlaylists(data.items || [])
    } catch (error) {
      console.error('Failed to fetch playlists:', error)
    }
  }

  const playPlaylist = async (playlist: Playlist) => {
    try {
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      const data = await response.json()
      if (data.items && data.items.length > 0) {
        const firstTrack = data.items[0].track
        setCurrentTrack(firstTrack)
        setCurrentPlaylist(playlist)
        setIsPlaying(true)
        // Play using Web Playback SDK
        if (isReady) {
          await playTrack(firstTrack.uri)
        }
      }
    } catch (error) {
      console.error('Failed to play playlist:', error)
    }
  }

  const togglePlayPause = () => {
    if (isPlaying) {
      pause()
    } else {
      resume()
    }
    setIsPlaying(!isPlaying)
  }

  const nextTrack = () => {
    playerNextTrack()
  }

  const previousTrack = () => {
    playerPreviousTrack()
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Connect to Spotify
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Connect your Spotify account to start streaming music.
            </p>
            <Button onClick={login} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              Login with Spotify
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Playlists */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Your Playlists</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => playPlaylist(playlist)}
                    >
                      <img
                        src={playlist.images[0]?.url || '/placeholder.jpg'}
                        alt={playlist.name}
                        className="w-12 h-12 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{playlist.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {playlist.tracks.total} tracks
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Player */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Now Playing</CardTitle>
            </CardHeader>
            <CardContent>
              {currentTrack ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={currentTrack.album.images[0]?.url || '/placeholder.jpg'}
                      alt={currentTrack.album.name}
                      className="w-24 h-24 rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{currentTrack.name}</h3>
                      <p className="text-muted-foreground">
                        {currentTrack.artists.map(a => a.name).join(', ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currentTrack.album.name}
                      </p>
                      <div className="mt-2">
                        <Equalizer isPlaying={isPlaying} />
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <Button variant="outline" size="icon" onClick={previousTrack}>
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button size="icon" onClick={togglePlayPause}>
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextTrack}>
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Progress bar placeholder */}
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '30%' }}></div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setIsMinimized(true)}
                    className="w-full"
                  >
                    Minimize Player
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Select a playlist to start playing music
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Widget */}
      {isMinimized && currentTrack && (
        <FloatingMusicWidget
          track={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={togglePlayPause}
          onClose={() => setIsMinimized(false)}
        />
      )}
    </>
  )
}