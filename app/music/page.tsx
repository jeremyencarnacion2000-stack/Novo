import { MusicPlayer } from '@/components/music/music-player'
import { SpotifyProvider } from '@/lib/spotify-context'

export default function MusicPage() {
  return (
    <SpotifyProvider>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Music Player</h1>
          <p className="text-muted-foreground">
            Your personal music streaming experience powered by Spotify.
          </p>
        </div>

        <MusicPlayer />
      </div>
    </SpotifyProvider>
  )
}