'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { Search, Home as HomeIcon, Library, Heart, Play, Shuffle, MoreHorizontal, ChevronLeft, ChevronRight, Music, Disc, Mic2, Radio, User, Clock, Plus, Loader2, LogOut, LogIn, Pause, SkipForward, SkipBack, Repeat, Volume2, Headphones, ListMusic, Grid, Mic, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchSpotifyData, SpotifyUser, SpotifyPlaylist, SpotifyTrack } from '@/lib/spotify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { usePlayerStore, CurrentTrack } from '@/lib/player-store'
import { cn } from '@/lib/utils'
import { useToast } from "@/components/ui/use-toast"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface PlaylistTrack {
  added_at: string
  track: SpotifyTrack
}

interface SpotifyArtist {
  id: string
  name: string
  images: { url: string }[]
  genres: string[]
  followers: { total: number }
}

interface SpotifyAlbum {
  id: string
  name: string
  images: { url: string }[]
  artists: { id: string; name: string }[]
  release_date: string
  total_tracks: number
  uri: string
}

interface SpotifyShow {
  id: string
  name: string
  images: { url: string }[]
  publisher: string
  description: string
  uri: string
}

interface RecentlyPlayedItem {
  track: SpotifyTrack
  played_at: string
}

type ViewType = 'home' | 'search' | 'library' | 'playlist' | 'popular' | 'songs' | 'artists' | 'albums' | 'podcasts' | 'artist'

export default function MusicPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [userProfile, setUserProfile] = useState<SpotifyUser | null>(null)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null)
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[] | null>(null)
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([])
  const [followedArtists, setFollowedArtists] = useState<SpotifyArtist[]>([])
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([])
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedItem[]>([])
  const [savedAlbums, setSavedAlbums] = useState<SpotifyAlbum[]>([])
  const [savedShows, setSavedShows] = useState<SpotifyShow[]>([])

  const [hasToken, setHasToken] = useState(false)
  const [tokenChecked, setTokenChecked] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([])
  const [searching, setSearching] = useState(false)
  const [currentView, setCurrentView] = useState<ViewType>('home')
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([])
  const [selectedArtist, setSelectedArtist] = useState<SpotifyArtist | null>(null)
  const [artistTracks, setArtistTracks] = useState<SpotifyTrack[]>([])

  const {
    playTrack,
    playPlaylist,
    currentTrack,
    isPlaying,
    queue,
    togglePlayPause,
    nextTrack,
    previousTrack
  } = usePlayerStore()

  // Check for Spotify token
  useEffect(() => {
    async function checkToken() {
      try {
        const response = await fetch('/api/spotify/has-token')
        const data = await response.json()
        setHasToken(data.hasToken)
      } catch (error) {
        setHasToken(false)
      } finally {
        setTokenChecked(true)
      }
    }
    checkToken()
  }, [])

  // Load Spotify data
  useEffect(() => {
    async function loadSpotifyData() {
      if (!tokenChecked || !hasToken) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const profileResponse = await fetch('/api/spotify/me')
        if (profileResponse.ok) setUserProfile(await profileResponse.json())

        const playlistsResponse = await fetch('/api/spotify/playlists?limit=20')
        if (playlistsResponse.ok) {
          const data = await playlistsResponse.json()
          setPlaylists(data.items || [])
        }

        const tracksResponse = await fetch('/api/spotify/tracks?limit=50')
        if (tracksResponse.ok) {
          const data = await tracksResponse.json()
          const tracks = data.items?.map((item: { track: SpotifyTrack }) => item.track) || []
          setSavedTracks(tracks)
        }

        const artistsResponse = await fetch('/api/spotify/top/artists?limit=10')
        if (artistsResponse.ok) {
          const data = await artistsResponse.json()
          setTopArtists(data.items || [])
        }

        const followedArtistsResponse = await fetch('/api/spotify/following')
        if (followedArtistsResponse.ok) {
          const data = await followedArtistsResponse.json()
          setFollowedArtists(data.items || [])
        }

        const topTracksResponse = await fetch('/api/spotify/top/tracks?limit=10&time_range=short_term')
        if (topTracksResponse.ok) {
          const data = await topTracksResponse.json()
          setTopTracks(data.items || [])
        }

        const recentlyPlayedResponse = await fetch('/api/spotify/recently-played?limit=20')
        if (recentlyPlayedResponse.ok) {
          const data = await recentlyPlayedResponse.json()
          setRecentlyPlayed(data.items || [])
        }

      } catch (err) {
        console.error('Failed to fetch Spotify data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSpotifyData()
  }, [hasToken, tokenChecked])

  // Load playlist tracks when selected
  useEffect(() => {
    async function loadPlaylistTracks() {
      if (!selectedPlaylist) return
      try {
        const response = await fetch(`/api/spotify/playlists/${selectedPlaylist.id}/tracks`)
        if (response.ok) {
          const data = await response.json()
          setPlaylistTracks(data.items || [])
        }
      } catch (err) {
        console.error('Error loading playlist tracks:', err)
      }
    }
    loadPlaylistTracks()
  }, [selectedPlaylist])

  const handleSearch = async () => {
    if (!searchQuery.trim() || !hasToken) return

    setSearching(true)
    setCurrentView('search')
    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=20`)
      const data = await response.json()
      if (response.ok) {
        setSearchResults(data.tracks?.items || [])
      } else {
        setSearchResults([])
      }
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleDisconnect = async () => {
    await signOut({ callbackUrl: '/music' })
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handlePlayPlaylist = (playlist: SpotifyPlaylist, tracks: PlaylistTrack[]) => {
    if (tracks.length === 0) return
    const trackList: CurrentTrack[] = tracks.map(item => ({
      id: item.track.id,
      uri: item.track.uri,
      name: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      artistId: item.track.artists[0]?.id,
      albumId: item.track.album?.id,
      image: item.track.album.images?.[0]?.url,
      duration_ms: item.track.duration_ms,
    }))
    playPlaylist({ id: playlist.id, name: playlist.name, tracks: trackList })
  }

  const openPlaylist = (playlist: SpotifyPlaylist) => {
    setSelectedPlaylist(playlist)
    setCurrentView('playlist')
  }

  const handleArtistClick = async (artist: SpotifyArtist) => {
    setSelectedArtist(artist)
    setCurrentView('artist')
    try {
      const response = await fetch(`/api/spotify/artist/${artist.id}/top-tracks`)
      if (response.ok) {
        const data = await response.json()
        setArtistTracks(data.tracks || [])
      }
    } catch (err) {
      console.error('Error loading artist tracks:', err)
    }
  }

  const handleNavClick = (view: ViewType) => {
    setCurrentView(view)
    if (['albums', 'podcasts'].includes(view)) {
      toast({
        title: "Feature coming soon",
        description: `The ${view} view is under development.`,
      })
    }
  }

  // Debounced search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch()
      } else if (currentView === 'search') {
        setCurrentView('home')
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  // Determine which tracks to display based on current view
  const getDisplayedTracks = () => {
    switch (currentView) {
      case 'search': return searchResults
      case 'playlist': return playlistTracks.map(pt => pt.track)
      case 'artist': return artistTracks
      case 'songs':
        // Local filtering for songs view
        if (searchQuery && currentView === 'songs') {
          return savedTracks?.filter(track =>
            track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            track.artists.some(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
          ) || []
        }
        return savedTracks
      default: return savedTracks
    }
  }

  const displayedTracks = getDisplayedTracks()

  if (!tokenChecked || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    )
  }

  if (!hasToken) {
    return (
      <div className="flex h-screen w-full overflow-hidden font-sans relative items-center justify-center">
        <div className="z-10 flex flex-col items-center gap-6 p-8 glass-panel rounded-3xl max-w-md text-center">
          <div className="bg-green-500 p-4 rounded-full">
            <Music className="h-12 w-12 text-black" />
          </div>
          <h1 className="text-3xl font-bold">Connect Spotify</h1>
          <p className="text-gray-400">Connect your Spotify account to access your library, playlists, and control playback directly from Novo.</p>
          <Button
            onClick={() => signIn('spotify', { callbackUrl: '/music' })}
            className="bg-green-500 hover:bg-green-400 text-black font-bold rounded-full px-8 py-6 text-lg w-full"
          >
            <LogIn className="mr-2 h-5 w-5" /> Connect with Spotify
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full text-white overflow-hidden font-sans relative p-4 gap-4">
      {/* Removed hardcoded background to allow global glass effect */}

      {/* Left Sidebar - Glass Panel */}
      <div className="hidden lg:flex w-64 flex-col gap-8 glass-panel rounded-3xl p-6 z-10">
        <div className="space-y-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-lg font-bold rounded-xl gap-3 h-12 px-4 transition-all duration-200",
              currentView === 'home' ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
            onClick={() => setCurrentView('home')}
          >
            <HomeIcon className="h-6 w-6" /> Home
          </Button>
        </div>

        <div className="space-y-2 pl-2">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-gray-400 hover:text-white hover:bg-white/5 rounded-xl gap-4 h-11 px-4 font-medium transition-colors",
              currentView === 'songs' && "bg-white/10 text-white"
            )}
            onClick={() => handleNavClick('songs')}
          >
            <Music className="h-5 w-5" /> Songs
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-gray-400 hover:text-white hover:bg-white/5 rounded-xl gap-4 h-11 px-4 font-medium transition-colors",
              currentView === 'artists' && "bg-white/10 text-white"
            )}
            onClick={() => handleNavClick('artists')}
          >
            <Mic2 className="h-5 w-5" /> Artists
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-gray-400 hover:text-white hover:bg-white/5 rounded-xl gap-4 h-11 px-4 font-medium transition-colors",
              currentView === 'albums' && "bg-white/10 text-white"
            )}
            onClick={() => handleNavClick('albums')}
          >
            <Disc className="h-5 w-5" /> Albums
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-gray-400 hover:text-white hover:bg-white/5 rounded-xl gap-4 h-11 px-4 font-medium transition-colors",
              currentView === 'podcasts' && "bg-white/10 text-white"
            )}
            onClick={() => handleNavClick('podcasts')}
          >
            <Radio className="h-5 w-5" /> Podcasts
          </Button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-2 mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Your Collections</h3>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-500 hover:text-white rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-1">
              <div
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
                onClick={() => handleNavClick('songs')}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                  <Heart className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate text-sm">Liked Songs</div>
                  <div className="text-xs text-gray-400 truncate">Playlist</div>
                </div>
              </div>
              {playlists?.map(playlist => (
                <div
                  key={playlist.id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
                  onClick={() => openPlaylist(playlist)}
                >
                  <img src={playlist.images?.[0]?.url || '/placeholder-album.png'} alt={playlist.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate text-sm">{playlist.name}</div>
                    <div className="text-xs text-gray-400 truncate">Playlist</div>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar />
          </ScrollArea>
        </div>

        {/* User Profile */}
        <div className="pt-4 border-t border-white/5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 px-2 hover:bg-white/10 rounded-xl h-12">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userProfile?.images?.[0]?.url} />
                  <AvatarFallback>{userProfile?.display_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-sm font-medium truncate w-full">{userProfile?.display_name || 'User'}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      userProfile?.product === 'premium' ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"
                    )}>
                      {userProfile?.product === 'premium' ? 'Premium' : 'Free'}
                    </span>
                    {userProfile?.product !== 'premium' && (
                      <AlertCircle className="h-3 w-3 text-yellow-500/50" />
                    )}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#1e1e1e] border-white/10 text-white" align="end">
              <DropdownMenuItem className="text-red-400 focus:text-red-400 focus:bg-white/10 cursor-pointer" onClick={handleDisconnect}>
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect Spotify
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content - Glass Panel */}
      <div className="flex-1 glass-panel rounded-3xl p-8 flex flex-col gap-8 overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white">Welcome back, {userProfile?.display_name?.split(' ')[0] || 'User'}!</h1>
            <p className="text-sm text-gray-400">{playlists?.length || 0} playlists for you</p>
          </div>
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by title, artist, or album..."
              className="bg-black/20 shadow-inner border-0 rounded-full pl-10 h-12 text-sm text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-white/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button size="icon" variant="ghost" className="rounded-full bg-white/5 hover:bg-white/10 text-white">
              <Grid className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10 border-2 border-white/10">
              <AvatarImage src={userProfile?.images?.[0]?.url} />
              <AvatarFallback>{userProfile?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="flex flex-col gap-8 flex-1 min-h-0">

          {/* Trending Songs */}
          {currentView === 'home' && (
            <div className="space-y-4 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Trending songs this week</h2>
                <span className="text-xs text-gray-400 cursor-pointer hover:text-white">See all</span>
              </div>
              <ScrollArea className="w-full whitespace-nowrap pb-4" horizontalWheel>
                <div className="flex gap-4">
                  {topTracks.map((track) => (
                    <div
                      key={track.id}
                      className="w-64 shrink-0 relative group cursor-pointer rounded-2xl overflow-hidden"
                      onClick={() => {
                        console.log('MusicPage: Play Trending Track clicked:', track.name, 'ID:', track.id, 'URI:', track.uri);

                        const tracksToPlay: CurrentTrack[] = topTracks.map(t => ({
                          id: t.id,
                          uri: t.uri,
                          name: t.name,
                          artist: t.artists.map(a => a.name).join(', '),
                          artistId: t.artists[0]?.id,
                          albumId: t.album?.id,
                          image: t.album.images[0]?.url,
                          duration_ms: t.duration_ms,
                        }));

                        playPlaylist({
                          id: 'trending-songs',
                          name: 'Trending Songs',
                          tracks: tracksToPlay
                        }, topTracks.indexOf(track));
                      }}
                    >
                      <img src={track.album.images[0]?.url} alt={track.name} className="w-full aspect-[4/3] object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end">
                        <h3 className="font-bold text-white truncate text-lg">{track.name}</h3>
                        <div className="flex items-center justify-between text-gray-300 text-sm">
                          <span className="truncate max-w-[70%]">{track.artists[0].name}</span>
                          <span>{formatDuration(track.duration_ms)}</span>
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[2px]">
                        <div className="bg-white/20 backdrop-blur-md p-3 rounded-full">
                          <Play className="h-6 w-6 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {/* Popular Artists */}
          {currentView === 'home' && (
            <div className="space-y-4 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Popular artists</h2>
                <span className="text-xs text-gray-400 cursor-pointer hover:text-white">See all</span>
              </div>
              <ScrollArea className="w-full whitespace-nowrap pb-2" horizontalWheel>
                <div className="flex gap-6">
                  {topArtists.map((artist) => (
                    <div
                      key={artist.id}
                      className="flex flex-col items-center gap-3 shrink-0 cursor-pointer group"
                      onClick={() => handleArtistClick(artist)}
                    >
                      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-transparent group-hover:border-white/20 transition-all">
                        <img src={artist.images[0]?.url} alt={artist.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      </div>
                      <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{artist.name}</span>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {/* Artists Grid View */}
          {currentView === 'artists' && (
            <ScrollArea className="flex-1 -mr-6 pr-6">
              <div className="space-y-4 pb-8">
                <h2 className="text-lg font-bold text-white">Your Artists</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {followedArtists.map((artist) => (
                    <div
                      key={artist.id}
                      className="flex flex-col items-center gap-3 cursor-pointer group"
                      onClick={() => handleArtistClick(artist)}
                    >
                      <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-transparent group-hover:border-white/20 transition-all">
                        <img src={artist.images[0]?.url} alt={artist.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      </div>
                      <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors text-center">{artist.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Recently Played / Playlist / Artist Tracks List */}
          {currentView !== 'artists' && (
            <div className="space-y-4 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-white">
                  {currentView === 'home' ? 'Recently played' :
                    currentView === 'playlist' ? selectedPlaylist?.name :
                      currentView === 'artist' ? `Top Tracks by ${selectedArtist?.name}` :
                        currentView === 'songs' ? 'Liked Songs' :
                          currentView === 'search' ? 'Search Results' : 'Tracks'}
                </h2>
                {currentView === 'home' && <span className="text-xs text-gray-400 cursor-pointer hover:text-white">See all</span>}
              </div>
              <ScrollArea className="flex-1 -mr-6 pr-6 min-h-0">
                <div className="space-y-2 pb-8">
                  {(currentView === 'home' ? recentlyPlayed.map(i => i.track) : displayedTracks)?.map((track, index) => (
                    <div
                      key={`${track.id}-${index}`}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => {
                        console.log('MusicPage: Play Track from List clicked:', track.name, 'ID:', track.id, 'URI:', track.uri);

                        // Get the actual list being displayed to create the correct context
                        const currentList = currentView === 'home' ? recentlyPlayed.map(i => i.track) : displayedTracks;

                        // Create a temporary playlist from the currently displayed tracks
                        const tracksToPlay: CurrentTrack[] = currentList.map(t => ({
                          id: t.id,
                          uri: t.uri,
                          name: t.name,
                          artist: t.artists.map(a => a.name).join(', '),
                          artistId: t.artists[0]?.id,
                          albumId: t.album?.id,
                          image: t.album.images?.[0]?.url,
                          duration_ms: t.duration_ms,
                        }));

                        playPlaylist({
                          id: currentView === 'playlist' ? (selectedPlaylist?.id || 'current-view') :
                            currentView === 'home' ? 'recently-played' : 'current-view',
                          name: currentView === 'playlist' ? (selectedPlaylist?.name || 'Current View') :
                            currentView === 'home' ? 'Recently Played' :
                              currentView === 'songs' ? 'Liked Songs' :
                                currentView === 'search' ? 'Search Results' : 'Current View',
                          tracks: tracksToPlay
                        }, index);
                      }}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden relative">
                        <img src={track.album.images[0]?.url} alt={track.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-4 w-4 text-white fill-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">{track.name}</h4>
                        <p className="text-xs text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</p>
                      </div>
                      <span className="text-xs text-gray-500 font-medium tabular-nums">{formatDuration(track.duration_ms)}</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

        </div>
      </div>

      {/* Right Sidebar - Glass Panel */}
      <div className="hidden xl:flex w-80 flex-col gap-6 z-10">

        {/* Now Playing Card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden group">
          <div className="flex items-center gap-2 text-white/80 mb-2">
            <div className="flex gap-1">
              <div className="w-0.5 h-3 bg-white animate-pulse" />
              <div className="w-0.5 h-4 bg-white animate-pulse delay-75" />
              <div className="w-0.5 h-2 bg-white animate-pulse delay-150" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Now Playing</span>
          </div>

          <div className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={currentTrack?.image || "https://i.scdn.co/image/ab676186000010164293385d324db8558179afd9"}
              alt={currentTrack?.name || "No Track"}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
              <h2 className="text-xl font-bold text-white truncate drop-shadow-md">{currentTrack?.name || "Select a song"}</h2>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-300 text-center truncate">{currentTrack?.artist || "To start listening"}</p>
            <div className="flex justify-between items-center mt-4 px-2">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white">
                <ListMusic className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white">
                <Heart className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Queue */}
        <div className="glass-panel rounded-3xl p-6 flex-1 min-h-0 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Queue</h3>
            <span className="text-xs text-gray-400 cursor-pointer hover:text-white">See all</span>
          </div>

          <ScrollArea className="flex-1 -mr-4 pr-4">
            <div className="space-y-3">
              {queue.length > 0 ? (
                queue.map((track, index) => (
                  <div key={`${track.id}-${index}`} className="flex items-center gap-3 group cursor-pointer">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative">
                      <img src={track.image} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center">
                        <Play className="h-3 w-3 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate text-sm">{track.name}</div>
                      <div className="text-xs text-gray-400 truncate">{track.artist}</div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-500 hover:text-white">
                      <Play className="h-3 w-3 fill-current" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
                  <ListMusic className="h-8 w-8 opacity-50" />
                  <span className="text-xs">Queue is empty</span>
                </div>
              )}
            </div>
            <ScrollBar />
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
