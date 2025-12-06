'use client'

import { DashboardShell } from '@/components/dashboard-shell'
import { useSession } from 'next-auth/react'
import { Search, Plus, Home as HomeIcon, Library, Heart, Clock, Play, Shuffle, MoreHorizontal, List, ChevronLeft, ChevronRight, Music } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchSpotifyData, SpotifyUser, SpotifyPlaylist, SpotifyTrack, SpotifyAlbum } from '@/lib/spotify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { Loader2 } from 'lucide-react'
import { usePlayerStore, CurrentTrack, Playlist } from '@/lib/player-store'
import { cn } from '@/lib/utils'

interface PlaylistTrack {
  added_at: string
  track: SpotifyTrack
}

type ViewType = 'home' | 'search' | 'library' | 'playlist'

export default function MusicPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userProfile, setUserProfile] = useState<SpotifyUser | null>(null)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null)
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[] | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [tokenChecked, setTokenChecked] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [currentView, setCurrentView] = useState<ViewType>('home')
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([])
  const [searching, setSearching] = useState(false)
  const [recommendations, setRecommendations] = useState<any>(null)

  const {
    playTrack,
    playPlaylist,
    currentTrack,
    isPlaying,
    togglePlayPause,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleRepeat,
    isShuffle,
    repeatMode,
    volume,
    setVolume,
    progress,
    setProgress,
    currentPlaylist
  } = usePlayerStore()

  // Check for Spotify token
  useEffect(() => {
    async function checkToken() {
      try {
        const response = await fetch('/api/spotify/has-token')
        const data = await response.json()
        setHasToken(data.hasToken)
        setIsPremium(data.isPremium || false)
      } catch (error) {
        setHasToken(false)
        setIsPremium(false)
      } finally {
        setTokenChecked(true)
      }
    }
    checkToken()
  }, [])

  // Load Spotify data
  useEffect(() => {
    async function loadSpotifyData() {
      // Wait for token check to complete
      if (!tokenChecked) return

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

        const playlistsResponse = await fetch('/api/spotify/playlists?limit=50')
        if (!playlistsResponse.ok) throw new Error('Failed to fetch playlists')
        const playlistsData = await playlistsResponse.json()
        setPlaylists(playlistsData.items || [])

        const tracksResponse = await fetch('/api/spotify/tracks?limit=50')
        if (!tracksResponse.ok) throw new Error('Failed to fetch tracks')
        const tracksData = await tracksResponse.json()
        const tracks = tracksData.items?.map((item: { track: SpotifyTrack }) => item.track) || []
        setSavedTracks(tracks)

        // Load recommendations if user has no playlists or saved tracks
        if ((playlistsData.items?.length === 0 || !playlistsData.items) && tracks.length === 0) {
          const recsResponse = await fetch('/api/spotify/recommendations?limit=20')
          if (recsResponse.ok) {
            const recsData = await recsResponse.json()
            setRecommendations(recsData)
          }
        }

      } catch (err: any) {
        console.error('Failed to fetch Spotify data:', err)
        setError(err.message || 'Failed to load Spotify data.')
      } finally {
        setLoading(false)
      }
    }

    loadSpotifyData()
  }, [hasToken, tokenChecked])

  // Load playlist tracks when a playlist is selected
  useEffect(() => {
    async function loadPlaylistTracks() {
      if (!selectedPlaylist) {
        setPlaylistTracks([])
        return
      }

      setLoadingTracks(true)
      try {
        const response = await fetch(`/api/spotify/playlists/${selectedPlaylist.id}/tracks`)
        if (!response.ok) throw new Error('Failed to fetch playlist tracks')
        const data = await response.json()
        setPlaylistTracks(data.items || [])
      } catch (err) {
        console.error('Error loading playlist tracks:', err)
        setPlaylistTracks([])
      } finally {
        setLoadingTracks(false)
      }
    }

    loadPlaylistTracks()
  }, [selectedPlaylist])

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    // Don't search if not connected to Spotify
    if (!hasToken) {
      console.log('Cannot search - not connected to Spotify')
      return
    }

    setSearching(true)
    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=20`)
      const data = await response.json()

      if (response.ok) {
        setSearchResults(data.tracks?.items || [])
        setCurrentView('search')
      } else if (response.status === 401) {
        console.log('Spotify not authenticated')
        setSearchResults([])
      } else {
        console.error('Search error:', data.error)
        setSearchResults([])
      }
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  const handlePlayPlaylist = (playlist: SpotifyPlaylist, tracks: PlaylistTrack[]) => {
    if (tracks.length === 0) return

    const trackList: CurrentTrack[] = tracks.map(item => ({
      id: item.track.id,
      uri: item.track.uri,
      name: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      artistId: item.track.artists[0]?.id,
      image: item.track.album.images?.[0]?.url,
      duration_ms: item.track.duration_ms,
    }))

    playPlaylist({
      id: playlist.id,
      name: playlist.name,
      tracks: trackList,
    })
  }

  const handlePlayTrack = (track: SpotifyTrack) => {
    playTrack({
      id: track.id,
      uri: track.uri,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      artistId: track.artists[0]?.id,
      image: track.album.images?.[0]?.url,
      duration_ms: track.duration_ms,
    })
  }

  const openPlaylist = (playlist: SpotifyPlaylist) => {
    setSelectedPlaylist(playlist)
    setCurrentView('playlist')
  }

  // Still checking token - show loading
  if (!tokenChecked) {
    return (
      <DashboardShell>
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#1a1a1a] to-black rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      </DashboardShell>
    )
  }

  // Not connected to Spotify
  if (!hasToken) {
    return (
      <DashboardShell>
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#1a1a1a] to-black rounded-lg">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto">
              <svg className="h-10 w-10 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Connect to Spotify</h1>
            <p className="text-gray-400">Link your Spotify account to access your music</p>
            <a
              href="/api/auth/spotify/login"
              className="inline-block bg-green-500 hover:bg-green-400 text-black font-semibold px-8 py-3 rounded-full transition-colors"
            >
              Connect Spotify
            </a>
          </div>
        </div>
      </DashboardShell>
    )
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#1a1a1a] to-black rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="flex-1 flex flex-col bg-black rounded-lg overflow-hidden">
        {/* Top Bar with Navigation and Search */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/50">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full bg-black/70 text-white"
                onClick={() => setCurrentView('home')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full bg-black/70 text-white opacity-50">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2">
              <Button
                variant={currentView === 'home' ? 'secondary' : 'ghost'}
                className={cn(
                  "rounded-full",
                  currentView === 'home' ? "bg-white text-black" : "bg-[#232323] text-white hover:bg-[#2a2a2a]"
                )}
                onClick={() => setCurrentView('home')}
              >
                <HomeIcon className="h-4 w-4 mr-2" />
                Home
              </Button>
              <Button
                variant={currentView === 'library' ? 'secondary' : 'ghost'}
                className={cn(
                  "rounded-full",
                  currentView === 'library' ? "bg-white text-black" : "bg-[#232323] text-white hover:bg-[#2a2a2a]"
                )}
                onClick={() => setCurrentView('library')}
              >
                <Library className="h-4 w-4 mr-2" />
                Library
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={hasToken ? "What do you want to play?" : "Connect Spotify to search"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && hasToken && handleSearch()}
                disabled={!hasToken}
                className={cn(
                  "w-80 pl-10 bg-[#242424] border-0 text-white placeholder:text-gray-400 rounded-full focus-visible:ring-2 focus-visible:ring-white",
                  !hasToken && "opacity-50 cursor-not-allowed"
                )}
              />
            </div>
            {/* User Profile */}
            {userProfile && (
              <div className="flex items-center gap-2 bg-black/30 hover:bg-black/50 rounded-full p-1 pr-3 cursor-pointer transition-colors">
                {userProfile.images?.[0]?.url ? (
                  <img
                    src={userProfile.images[0].url}
                    alt={userProfile.display_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {userProfile.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <span className="text-white text-sm font-medium">{userProfile.display_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <ScrollArea className="flex-1">
          {/* Home View */}
          {currentView === 'home' && (
            <div className="p-6 bg-gradient-to-b from-[#1a3a2a] to-[#121212]">
              {/* Greeting */}
              <h1 className="text-3xl font-bold text-white mb-6">
                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
              </h1>

              {/* Quick Access Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {/* Liked Songs */}
                <div
                  className="flex items-center gap-4 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-colors group"
                  onClick={() => setCurrentView('library')}
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-700 to-blue-300 flex items-center justify-center rounded-l">
                    <Heart className="h-8 w-8 text-white fill-white" />
                  </div>
                  <span className="font-semibold text-white">Liked Songs</span>
                  <Button
                    size="icon"
                    className="w-12 h-12 rounded-full bg-green-500 text-black opacity-0 group-hover:opacity-100 transition-opacity ml-auto mr-4 shadow-lg"
                  >
                    <Play className="h-5 w-5 fill-black ml-0.5" />
                  </Button>
                </div>

                {/* Recent Playlists */}
                {playlists?.slice(0, 5).map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center gap-4 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-colors group"
                    onClick={() => openPlaylist(playlist)}
                  >
                    <img
                      src={playlist.images?.[0]?.url || '/placeholder-album.png'}
                      alt={playlist.name}
                      className="w-20 h-20 object-cover rounded-l"
                    />
                    <span className="font-semibold text-white truncate flex-1">{playlist.name}</span>
                    <Button
                      size="icon"
                      className="w-12 h-12 rounded-full bg-green-500 text-black opacity-0 group-hover:opacity-100 transition-opacity ml-auto mr-4 shadow-lg"
                    >
                      <Play className="h-5 w-5 fill-black ml-0.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Your Playlists Section */}
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">Your Playlists</h2>
                  <Button variant="link" className="text-gray-400 hover:text-white">Show all</Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {playlists?.slice(0, 5).map((playlist) => (
                    <div
                      key={playlist.id}
                      className="p-4 bg-[#181818] hover:bg-[#282828] rounded-lg cursor-pointer transition-colors group"
                      onClick={() => openPlaylist(playlist)}
                    >
                      <div className="relative mb-4">
                        <img
                          src={playlist.images?.[0]?.url || '/placeholder-album.png'}
                          alt={playlist.name}
                          className="w-full aspect-square object-cover rounded shadow-lg"
                        />
                        <Button
                          size="icon"
                          className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-green-500 text-black opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all shadow-lg"
                        >
                          <Play className="h-5 w-5 fill-black ml-0.5" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-white truncate">{playlist.name}</h3>
                      <p className="text-sm text-gray-400 truncate">By {playlist.owner?.display_name}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recently Played / Liked Songs Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">Your Liked Songs</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {savedTracks?.slice(0, 5).map((track) => (
                    <div
                      key={track.id}
                      className="p-4 bg-[#181818] hover:bg-[#282828] rounded-lg cursor-pointer transition-colors group"
                      onClick={() => handlePlayTrack(track)}
                    >
                      <div className="relative mb-4">
                        <img
                          src={track.album.images?.[0]?.url || '/placeholder-album.png'}
                          alt={track.album.name}
                          className="w-full aspect-square object-cover rounded shadow-lg"
                        />
                        <Button
                          size="icon"
                          className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-green-500 text-black opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all shadow-lg"
                        >
                          <Play className="h-5 w-5 fill-black ml-0.5" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-white truncate">{track.name}</h3>
                      <p className="text-sm text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recommendations Section - Show when user has no playlists/tracks */}
              {recommendations && (playlists?.length === 0 && savedTracks?.length === 0) && (
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white">{recommendations.message || 'Discover New Music'}</h2>
                  </div>
                  {recommendations.albums && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {recommendations.albums.slice(0, 10).map((album: any) => (
                        <div
                          key={album.id}
                          className="p-4 bg-[#181818] hover:bg-[#282828] rounded-lg cursor-pointer transition-colors group"
                        >
                          <div className="relative mb-4">
                            <img
                              src={album.images?.[0]?.url || '/placeholder-album.png'}
                              alt={album.name}
                              className="w-full aspect-square object-cover rounded shadow-lg"
                            />
                            <Button
                              size="icon"
                              className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-green-500 text-black opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 transition-all shadow-lg"
                            >
                              <Play className="h-5 w-5 fill-black ml-0.5" />
                            </Button>
                          </div>
                          <h3 className="font-semibold text-white truncate">{album.name}</h3>
                          <p className="text-sm text-gray-400 truncate">{album.artists?.map((a: any) => a.name).join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Empty State - When no content and no recommendations */}
              {(!playlists || playlists.length === 0) && (!savedTracks || savedTracks.length === 0) && !recommendations && (
                <div className="text-center py-12">
                  <Music className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No music yet</h3>
                  <p className="text-gray-400 mb-4">Search for songs to add to your library</p>
                </div>
              )}
            </div>
          )}

          {/* Search Results View */}
          {currentView === 'search' && (
            <div className="p-6 bg-gradient-to-b from-[#1a1a1a] to-[#121212]">
              <h2 className="text-2xl font-bold text-white mb-6">Search Results for "{searchQuery}"</h2>
              {searching ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((track, index) => (
                    <div
                      key={track.id}
                      className={cn(
                        "flex items-center gap-4 p-2 rounded hover:bg-white/10 cursor-pointer",
                        currentTrack?.id === track.id && "bg-white/10"
                      )}
                      onClick={() => handlePlayTrack(track)}
                    >
                      <span className="w-8 text-center text-gray-400">{index + 1}</span>
                      <img src={track.album.images?.[0]?.url} alt="" className="w-10 h-10 rounded" />
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium truncate", currentTrack?.id === track.id ? "text-green-500" : "text-white")}>
                          {track.name}
                        </p>
                        <p className="text-sm text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</p>
                      </div>
                      <span className="text-gray-400 text-sm">{formatDuration(track.duration_ms)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Library View */}
          {currentView === 'library' && (
            <div className="p-6 bg-gradient-to-b from-indigo-900/50 to-[#121212]">
              <div className="flex items-end gap-6 mb-8">
                <div className="w-48 h-48 bg-gradient-to-br from-indigo-700 to-blue-300 rounded shadow-2xl flex items-center justify-center">
                  <Heart className="h-20 w-20 text-white fill-white" />
                </div>
                <div>
                  <p className="text-xs text-white uppercase font-medium">Playlist</p>
                  <h1 className="text-5xl font-bold text-white mt-2 mb-4">Liked Songs</h1>
                  <p className="text-sm text-gray-300">{userProfile?.display_name} • {savedTracks?.length || 0} songs</p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <Button className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-transform">
                  <Play className="h-6 w-6 text-black fill-black ml-1" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <Shuffle className="h-6 w-6" />
                </Button>
              </div>

              <div className="space-y-2">
                {savedTracks?.map((track, index) => (
                  <div
                    key={track.id}
                    className={cn(
                      "grid grid-cols-[40px_1fr_1fr_60px] gap-4 p-2 rounded hover:bg-white/10 cursor-pointer items-center",
                      currentTrack?.id === track.id && "bg-white/10"
                    )}
                    onClick={() => handlePlayTrack(track)}
                  >
                    <span className="text-sm text-gray-400 text-center">{index + 1}</span>
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={track.album.images?.[0]?.url} alt="" className="w-10 h-10 rounded" />
                      <div className="min-w-0">
                        <p className={cn("font-medium truncate", currentTrack?.id === track.id ? "text-green-500" : "text-white")}>
                          {track.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400 truncate">{track.album.name}</span>
                    <span className="text-sm text-gray-400 text-right">{formatDuration(track.duration_ms)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlist View */}
          {currentView === 'playlist' && selectedPlaylist && (
            <div className="bg-gradient-to-b from-[#3a3a3a] to-[#121212]">
              <div className="p-6 pt-8 flex items-end gap-6">
                <img
                  src={selectedPlaylist.images?.[0]?.url || '/placeholder-album.png'}
                  alt={selectedPlaylist.name}
                  className="w-48 h-48 rounded shadow-2xl object-cover"
                />
                <div>
                  <p className="text-xs text-white uppercase font-medium">Playlist</p>
                  <h1 className="text-5xl font-bold text-white mt-2 mb-4">{selectedPlaylist.name}</h1>
                  <p className="text-sm text-gray-300">
                    {selectedPlaylist.owner?.display_name} • {playlistTracks.length} songs
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 flex items-center gap-4">
                <Button
                  onClick={() => handlePlayPlaylist(selectedPlaylist, playlistTracks)}
                  className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-transform"
                >
                  <Play className="h-6 w-6 text-black fill-black ml-1" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <Shuffle className="h-6 w-6" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <MoreHorizontal className="h-6 w-6" />
                </Button>
              </div>

              <div className="px-6 grid grid-cols-[40px_1fr_1fr_120px_60px] gap-4 text-xs text-gray-400 border-b border-white/10 pb-2">
                <span>#</span>
                <span>Title</span>
                <span>Album</span>
                <span>Date added</span>
                <span className="text-right"><Clock className="h-4 w-4 inline" /></span>
              </div>

              <div className="px-6 pb-8">
                {loadingTracks ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  playlistTracks.map((item, index) => (
                    <div
                      key={item.track.id + index}
                      className={cn(
                        "grid grid-cols-[40px_1fr_1fr_120px_60px] gap-4 py-2 px-2 -mx-2 rounded hover:bg-white/10 group cursor-pointer items-center",
                        currentTrack?.id === item.track.id && "bg-white/10"
                      )}
                      onClick={() => handlePlayTrack(item.track)}
                    >
                      <span className="text-sm text-gray-400 text-center group-hover:hidden">{index + 1}</span>
                      <Play className="h-4 w-4 text-white hidden group-hover:block mx-auto" />
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={item.track.album.images?.[0]?.url} alt="" className="w-10 h-10 rounded" />
                        <div className="min-w-0">
                          <p className={cn("font-medium truncate", currentTrack?.id === item.track.id ? "text-green-500" : "text-white")}>
                            {item.track.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{item.track.artists.map(a => a.name).join(', ')}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-400 truncate">{item.track.album.name}</span>
                      <span className="text-sm text-gray-400">{formatDate(item.added_at)}</span>
                      <span className="text-sm text-gray-400 text-right">{formatDuration(item.track.duration_ms)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Bottom Player Bar */}
        {currentTrack && (
          <div className="h-24 bg-[#181818] border-t border-white/10 px-4 flex items-center justify-between shrink-0">
            {/* Left: Now Playing */}
            <div className="flex items-center gap-3 w-[30%]">
              {currentTrack.image && (
                <img src={currentTrack.image} alt={currentTrack.name} className="w-14 h-14 rounded" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentTrack.name}</p>
                <p className="text-xs text-gray-400 truncate">{currentTrack.artist}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Heart className="h-4 w-4" />
              </Button>
            </div>

            {/* Center: Controls */}
            <div className="flex flex-col items-center w-[40%]">
              <div className="flex items-center gap-4">
                {/* Shuffle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleShuffle}
                  className={cn("hover:text-white", isShuffle ? "text-green-500" : "text-gray-400")}
                  title={isShuffle ? "Shuffle On" : "Shuffle Off"}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>

                {/* Previous */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={previousTrack}
                  disabled={!currentPlaylist}
                  className="text-gray-400 hover:text-white disabled:opacity-50"
                  title="Previous"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.149V14.3a.7.7 0 01-.7.7H1.7a.7.7 0 01-.7-.7V1.7a.7.7 0 01.7-.7h1.6z" />
                  </svg>
                </Button>

                {/* Play/Pause */}
                <Button
                  onClick={togglePlayPause}
                  className="w-8 h-8 rounded-full bg-white hover:scale-105 transition-transform"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg className="h-4 w-4 text-black" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z" />
                    </svg>
                  ) : (
                    <Play className="h-4 w-4 text-black fill-black ml-0.5" />
                  )}
                </Button>

                {/* Next */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextTrack}
                  disabled={!currentPlaylist}
                  className="text-gray-400 hover:text-white disabled:opacity-50"
                  title="Next"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.149V14.3a.7.7 0 00.7.7h1.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-1.6z" />
                  </svg>
                </Button>

                {/* Repeat */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleRepeat}
                  className={cn("hover:text-white relative", repeatMode !== 'off' ? "text-green-500" : "text-gray-400")}
                  title={`Repeat: ${repeatMode}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M0 4.75A3.75 3.75 0 013.75 1h8.5A3.75 3.75 0 0116 4.75v5a3.75 3.75 0 01-3.75 3.75H9.81l1.018 1.018a.75.75 0 11-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 111.06 1.06L9.81 12h2.44a2.25 2.25 0 002.25-2.25v-5a2.25 2.25 0 00-2.25-2.25h-8.5A2.25 2.25 0 001.5 4.75v5A2.25 2.25 0 003.75 12H5v1.5H3.75A3.75 3.75 0 010 9.75v-5z" />
                  </svg>
                  {repeatMode === 'track' && (
                    <span className="absolute -top-1 -right-1 text-[8px] bg-green-500 text-black rounded-full w-3 h-3 flex items-center justify-center font-bold">1</span>
                  )}
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400 w-10 text-right">{formatDuration(progress)}</span>
                <Slider
                  value={[progress]}
                  max={currentTrack.duration_ms || 100}
                  step={1000}
                  onValueChange={(value) => setProgress(value[0])}
                  className="flex-1 cursor-pointer"
                />
                <span className="text-xs text-gray-400 w-10">{currentTrack.duration_ms ? formatDuration(currentTrack.duration_ms) : '0:00'}</span>
              </div>
            </div>

            {/* Right: Volume */}
            <div className="flex items-center gap-2 w-[30%] justify-end">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                {volume === 0 ? (
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.86 5.47a.75.75 0 00-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 008.8 6.53L10.269 8l-1.47 1.47a.75.75 0 101.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 001.06-1.06L12.39 8l1.47-1.47a.75.75 0 000-1.06z" />
                    <path d="M10.116 1.5A.75.75 0 008.991.85l-6.925 4a3.642 3.642 0 00-1.33 4.967 3.639 3.639 0 001.33 1.332l6.925 4a.75.75 0 001.125-.649v-13a.75.75 0 00-.001-.001z" />
                  </svg>
                ) : volume < 0.5 ? (
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 010 4.88z" />
                  </svg>
                )}
              </Button>
              <Slider
                value={[volume * 100]}
                max={100}
                step={1}
                onValueChange={(value) => setVolume(value[0] / 100)}
                className="w-24 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}