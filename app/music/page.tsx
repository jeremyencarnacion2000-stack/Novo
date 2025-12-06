'use client'

import { DashboardShell } from '@/components/dashboard-shell'
import { useSession, signIn } from 'next-auth/react'
import { Search, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchSpotifyData, SpotifyUser, SpotifyPlaylist, SpotifyTrack, SpotifyAlbum, SpotifyPaging } from '@/lib/spotify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { usePlayerStore, CurrentTrack, Playlist } from '@/lib/player-store'
import { PlaylistView } from '@/components/music/playlist-view'

export default function MusicPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userProfile, setUserProfile] = useState<SpotifyUser | null>(null)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null)
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[] | null>(null)
  const [savedAlbums, setSavedAlbums] = useState<SpotifyAlbum[] | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { playTrack, playPlaylist } = usePlayerStore()

  useEffect(() => {
    async function loadSpotifyData() {
      if (!hasToken) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const profileResponse = await fetch('/api/spotify/me')
        if (!profileResponse.ok) throw new Error('Failed to fetch user profile')
        const profile = await profileResponse.json()
        setUserProfile(profile)

        // Fetch more items for better search experience (limit=50)
        const playlistsResponse = await fetch('/api/spotify/playlists?limit=50')
        if (!playlistsResponse.ok) throw new Error('Failed to fetch playlists')
        const playlistsData = await playlistsResponse.json()
        setPlaylists(playlistsData.items)

        const tracksResponse = await fetch('/api/spotify/tracks?limit=50')
        if (!tracksResponse.ok) throw new Error('Failed to fetch tracks')
        const tracksData = await tracksResponse.json()
        setSavedTracks(tracksData.items.map((item: { track: SpotifyTrack }) => item.track))

        const albumsResponse = await fetch('/api/spotify/albums?limit=50')
        if (!albumsResponse.ok) throw new Error('Failed to fetch albums')
        const albumsData = await albumsResponse.json()
        setSavedAlbums(albumsData.items.map((item: { album: SpotifyAlbum }) => item.album))

      } catch (err: any) {
        console.error('Failed to fetch Spotify data:', err)
        setError(err.message || 'Failed to load Spotify data.')
      } finally {
        setLoading(false)
      }
    }

    loadSpotifyData()
  }, [hasToken])

  useEffect(() => {
    async function checkToken() {
      try {
        const response = await fetch('/api/spotify/has-token')
        const data = await response.json()
        console.log('DEBUG: Has token:', data.hasToken, 'isPremium:', data.isPremium)
        setHasToken(data.hasToken)
        setIsPremium(data.isPremium || false)
      } catch (error) {
        console.error('DEBUG: Error checking token:', error)
        setHasToken(false)
        setIsPremium(false)
      }
    }
    checkToken()
  }, [])

  // Filter items based on search query
  const filteredPlaylists = playlists?.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredTracks = savedTracks?.filter(track =>
    track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artists.some(artist => artist.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    track.album.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredAlbums = savedAlbums?.filter(album =>
    album.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    album.artists.some(artist => artist.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const [searchResults, setSearchResults] = useState<{
    tracks: { items: SpotifyTrack[] }
    albums: { items: SpotifyAlbum[] }
    playlists: { items: SpotifyPlaylist[] }
  } | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true)
        try {
          const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}&type=track,album,playlist&limit=10`)
          if (res.ok) {
            const data = await res.json()
            setSearchResults(data)
          }
        } catch (e) {
          console.error('Search failed', e)
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults(null)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSaveTrack = async (trackId: string) => {
    try {
      const res = await fetch('/api/spotify/me/tracks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [trackId] })
      })
      if (res.ok) {
        // Refresh saved tracks
        const tracksResponse = await fetch('/api/spotify/tracks?limit=50')
        if (tracksResponse.ok) {
          const tracksData = await tracksResponse.json()
          setSavedTracks(tracksData.items.map((item: { track: SpotifyTrack }) => item.track))
        }
      }
    } catch (e) {
      console.error('Failed to save track', e)
    }
  }

  // ... (loading and error states)

  const [selectedPlaylist, setSelectedPlaylist] = useState<{
    id: string
    type: 'playlist' | 'album' | 'saved-tracks'
    title: string
    description?: string
    image?: string
  } | null>(null)

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* ... (existing header and search) ... */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Your Spotify Music</h1>
            {!hasToken && (
              <Button onClick={() => signIn('spotify')} className="bg-[#1DB954] hover:bg-[#1ed760] text-white">
                Connect Spotify
              </Button>
            )}
          </div>

          {hasToken && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for new songs, albums, or playlists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Search Results</h2>
              <Button variant="ghost" onClick={() => setSearchQuery('')} size="sm">Clear Search</Button>
            </div>

            {/* Tracks Results */}
            {searchResults.tracks?.items.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Songs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.tracks.items.map((track) => (
                    <Card key={track.id}>
                      <CardHeader className="flex-row items-center space-x-4 space-y-0 p-4">
                        {track.album.images?.[0]?.url && (
                          <img src={track.album.images[0].url} alt={track.album.name} className="w-12 h-12 rounded-md" />
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-medium truncate">{track.name}</CardTitle>
                          <CardDescription className="text-xs truncate">{track.artists.map(a => a.name).join(', ')}</CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSaveTrack(track.id)}
                          title="Save to Liked Songs"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8"
                          onClick={() => playTrack({
                            id: track.id,
                            uri: track.uri,
                            name: track.name,
                            artist: track.artists.map(a => a.name).join(', '),
                            artistId: track.artists[0]?.id,
                            image: track.album.images?.[0]?.url,
                            duration_ms: track.duration_ms,
                          })}
                        >
                          Play
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Albums Results */}
            {searchResults.albums?.items.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Albums</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.albums.items.map((album) => (
                    <Card key={album.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedPlaylist({
                      id: album.id,
                      type: 'album',
                      title: album.name,
                      description: album.artists.map(a => a.name).join(', '),
                      image: album.images?.[0]?.url
                    })}>
                      <CardHeader className="flex-row items-center space-x-4 space-y-0 p-4">
                        {album.images?.[0]?.url && (
                          <img src={album.images[0].url} alt={album.name} className="w-12 h-12 rounded-md" />
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-medium truncate">{album.name}</CardTitle>
                          <CardDescription className="text-xs truncate">{album.artists.map(a => a.name).join(', ')}</CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Default View (when not searching) */}
        {!searchResults && !searchQuery && (
          <>
            {userProfile && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {userProfile.images?.[0]?.url && (
                      <img src={userProfile.images[0].url} alt={userProfile.display_name} className="w-8 h-8 rounded-full" />
                    )}
                    Welcome, {userProfile.display_name}
                  </CardTitle>
                  <CardDescription>Your Spotify Profile</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">Email: {userProfile.email}</p>
                  <p className="text-sm">
                    <Link href={userProfile.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      View Profile on Spotify
                    </Link>
                  </p>
                </CardContent>
              </Card>
            )}

            {playlists && playlists.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold">Your Playlists</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {playlists.map((playlist) => (
                      <Card
                        key={playlist.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors group"
                        onClick={() => setSelectedPlaylist({
                          id: playlist.id,
                          type: 'playlist',
                          title: playlist.name,
                          description: playlist.description,
                          image: playlist.images?.[0]?.url
                        })}
                      >
                        <CardHeader className="flex-row items-center space-x-4 space-y-0">
                          {playlist.images?.[0]?.url && (
                            <img src={playlist.images[0].url} alt={playlist.name} className="w-16 h-16 rounded-md shadow-sm group-hover:shadow-md transition-shadow" />
                          )}
                          <div>
                            <CardTitle className="text-lg group-hover:text-primary transition-colors">{playlist.name}</CardTitle>
                            <CardDescription className="line-clamp-2">{playlist.description || 'No description'} • By {playlist.owner.display_name} • {playlist.tracks.total} songs</CardDescription>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}

            {savedTracks && savedTracks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Your Saved Tracks</h2>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setSelectedPlaylist({
                        id: 'saved-tracks',
                        type: 'saved-tracks',
                        title: 'Liked Songs',
                        description: 'Your saved tracks from Spotify',
                        image: savedTracks[0]?.album.images?.[0]?.url
                      })}
                    >
                      View All Liked Songs
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedTracks.slice(0, 6).map((track) => (
                      <Card key={track.id}>
                        <CardHeader className="flex-row items-center space-x-4 space-y-0">
                          {track.album.images?.[0]?.url && (
                            <img src={track.album.images[0].url} alt={track.album.name} className="w-12 h-12 rounded-md" />
                          )}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium truncate">{track.name}</CardTitle>
                            <CardDescription className="text-xs truncate">{track.artists.map(artist => artist.name).join(', ')}</CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => playTrack({
                              id: track.id,
                              uri: track.uri,
                              name: track.name,
                              artist: track.artists.map(a => a.name).join(', '),
                              artistId: track.artists[0]?.id,
                              image: track.album.images?.[0]?.url,
                              duration_ms: track.duration_ms,
                            })}
                          >
                            <Plus className="h-4 w-4 rotate-45" /> {/* Play icon placeholder */}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}

            {savedAlbums && savedAlbums.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold">Your Saved Albums</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedAlbums.map((album) => (
                      <Card
                        key={album.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors group"
                        onClick={() => setSelectedPlaylist({
                          id: album.id,
                          type: 'album',
                          title: album.name,
                          description: album.artists.map(a => a.name).join(', '),
                          image: album.images?.[0]?.url
                        })}
                      >
                        <CardHeader className="flex-row items-center space-x-4 space-y-0">
                          {album.images?.[0]?.url && (
                            <img src={album.images[0].url} alt={album.name} className="w-16 h-16 rounded-md shadow-sm group-hover:shadow-md transition-shadow" />
                          )}
                          <div>
                            <CardTitle className="text-lg group-hover:text-primary transition-colors">{album.name}</CardTitle>
                            <CardDescription>{album.artists.map(artist => artist.name).join(', ')}</CardDescription>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {selectedPlaylist && (
        <PlaylistView
          isOpen={!!selectedPlaylist}
          onClose={() => setSelectedPlaylist(null)}
          playlistId={selectedPlaylist.id}
          type={selectedPlaylist.type}
          title={selectedPlaylist.title}
          description={selectedPlaylist.description}
          image={selectedPlaylist.image}
        />
      )}
    </DashboardShell>
  )
}