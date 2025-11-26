'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { useSpotifyPlayer } from '@/lib/use-spotify-player'

export function MusicPlayer() {
  const { playerState, play, pause, nextTrack, previousTrack, seek, setVolume } = useSpotifyPlayer()
  const [currentVolume, setCurrentVolume] = useState([0.5])

  const handlePlayPause = () => {
    if (playerState.isPlaying) {
      pause()
    } else {
      play()
    }
  }

  const handleSeek = (value: number[]) => {
    seek(value[0])
  }

  const handleVolumeChange = (value: number[]) => {
    const vol = value[0]
    setCurrentVolume([vol])
    setVolume(vol)
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!playerState.isReady) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Inicializando reproductor de Spotify...
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reproductor de Spotify</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {playerState.currentTrack && (
          <div className="text-center">
            <img
              src={playerState.currentTrack.album.images[0]?.url}
              alt={playerState.currentTrack.album.name}
              className="w-32 h-32 mx-auto rounded-lg mb-2"
            />
            <h3 className="font-semibold">{playerState.currentTrack.name}</h3>
            <p className="text-sm text-muted-foreground">
              {playerState.currentTrack.artists.map((artist: any) => artist.name).join(', ')}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Slider
            value={[playerState.position]}
            max={playerState.duration}
            step={1000}
            onValueChange={handleSeek}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(playerState.position)}</span>
            <span>{formatTime(playerState.duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2">
          <Button variant="outline" size="icon" onClick={previousTrack}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="icon" onClick={handlePlayPause}>
            {playerState.isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={nextTrack}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Volume2 className="h-4 w-4" />
          <Slider
            value={currentVolume}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="flex-1"
          />
        </div>

        <div className="mt-4">
          <iframe
            src="https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M"
            width="100%"
            height="380"
            frameBorder="0"
            allowTransparency={true}
            allow="encrypted-media"
            title="Spotify Playlist Embed"
          />
        </div>
      </CardContent>
    </Card>
  )
}