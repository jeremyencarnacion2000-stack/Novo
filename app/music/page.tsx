'use client'

import { useSession } from 'next-auth/react'
import { Search, Plus, Home, Library, Heart, Clock, Play, Shuffle, MoreHorizontal, List } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchSpotifyData, SpotifyUser, SpotifyPlaylist, SpotifyTrack, SpotifyAlbum } from '@/lib/spotify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { usePlayerStore, CurrentTrack, Playlist } from '@/lib/player-store'
import { cn } from '@/lib/utils'

interface PlaylistTrack {
  added_at: string
  track: SpotifyTrack
}

export default function MusicPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userProfile, setUserProfile] = useState<SpotifyUser | null>(null)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null)
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[] | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [activeTab, setActiveTab] = useState<'playlists' | 'artists' | 'albums'>('playlists')

  const { playTrack, playPlaylist, currentTrack, isPlaying, togglePlayPause } = usePlayerStore()

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
      }
    }
    checkToken()
  }, [])

  // Load Spotify data
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

        const playlistsResponse = await fetch('/api/spotify/playlists?limit=50')
        if (!playlistsResponse.ok) throw new Error('Failed to fetch playlists')
        const playlistsData = await playlistsResponse.json()
        setPlaylists(playlistsData.items)

        const tracksResponse = await fetch('/api/spotify/me/tracks?limit=50')
        if (!tracksResponse.ok) throw new Error('Failed to fetch tracks')
        const tracksData = await tracksResponse.json()
        setSavedTracks(tracksData.items?.map((item: { track: SpotifyTrack }) => item.track) || [])

      } catch (err: any) {
        console.error('Failed to fetch Spotify data:', err)
        setError(err.message || 'Failed to load Spotify data.')
      } finally {
        setLoading(false)
      }
    }

    loadSpotifyData()
  }, [hasToken])

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

  // Filter playlists based on search
  const filteredPlaylists = playlists?.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

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

  const handlePlayPlaylist = () => {
    if (!selectedPlaylist || playlistTracks.length === 0) return

    const tracks: CurrentTrack[] = playlistTracks.map(item => ({
      id: item.track.id,
      uri: item.track.uri,
      name: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      artistId: item.track.artists[0]?.id,
      image: item.track.album.images?.[0]?.url,
      duration_ms: item.track.duration_ms,
    }))

    playPlaylist({
      id: selectedPlaylist.id,
      name: selectedPlaylist.name,
      tracks,
    })
  }

  const handlePlayTrack = (track: SpotifyTrack, index: number) => {
    if (!selectedPlaylist) {
      // Play single track
      playTrack({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        artistId: track.artists[0]?.id,
        image: track.album.images?.[0]?.url,
        duration_ms: track.duration_ms,
      })
    } else {
      // Play from playlist starting at this track
      const tracks: CurrentTrack[] = playlistTracks.map(item => ({
        id: item.track.id,
        uri: item.track.uri,
        name: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        artistId: item.track.artists[0]?.id,
        image: item.track.album.images?.[0]?.url,
        duration_ms: item.track.duration_ms,
      }))

      playPlaylist({
        id: selectedPlaylist.id,
        name: selectedPlaylist.name,
        tracks,
      }, index)
    }
  }

  // Not connected to Spotify
  if (!hasToken) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Connect to Spotify</h1>
          <p className="text-gray-400">Link your Spotify account to access your music</p>
          <Button
            onClick={() => window.location.href = '/api/auth/spotify/login'}
            className="bg-green-500 hover:bg-green-600 text-black font-semibold"
          >
            Connect Spotify
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mini Navigation Sidebar */}
        <div className="w-16 flex flex-col items-center py-4 bg-black gap-4">
          <a href="/" className="w-12 h-12 rounded-full bg-[#282828] hover:bg-[#3e3e3e] flex items-center justify-center transition-colors" title="Go to Dashboard">
            <Home className="h-6 w-6 text-white" />
          </a>
          <a href="/music" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center" title="Music">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </a>
          <div className="flex-1" />
          <a href="/settings" className="w-10 h-10 rounded-full bg-[#282828] hover:bg-[#3e3e3e] flex items-center justify-center transition-colors" title="Settings">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </a>
        </div>

        {/* Left Sidebar - Library */}
        <div className="w-80 flex flex-col bg-black p-2 gap-2">
          {/* Library Card */}
          <div className="bg-[#121212] rounded-lg flex-1 flex flex-col overflow-hidden">
            {/* Library Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-gray-400 hover:text-white cursor-pointer">
                <Library className="h-6 w-6" />
                <span className="font-semibold">Your Library</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10">
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 flex gap-2">
              <Button
                variant={activeTab === 'playlists' ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  "rounded-full text-xs",
                  activeTab === 'playlists' ? 'bg-white text-black hover:bg-white/90' : 'bg-[#232323] text-white hover:bg-[#2a2a2a]'
                )}
                onClick={() => setActiveTab('playlists')}
              >
                Playlists
              </Button>
              <Button
                variant={activeTab === 'artists' ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  "rounded-full text-xs",
                  activeTab === 'artists' ? 'bg-white text-black hover:bg-white/90' : 'bg-[#232323] text-white hover:bg-[#2a2a2a]'
                )}
                onClick={() => setActiveTab('artists')}
              >
                Artists
              </Button>
              <Button
                variant={activeTab === 'albums' ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  "rounded-full text-xs",
                  activeTab === 'albums' ? 'bg-white text-black hover:bg-white/90' : 'bg-[#232323] text-white hover:bg-[#2a2a2a]'
                )}
                onClick={() => setActiveTab('albums')}
              >
                Albums
              </Button>
            </div>

            {/* Search in Library */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="relative flex-1 max-w-[140px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 bg-transparent border-0 text-sm text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <span className="text-xs text-gray-400">Recents</span>
            </div>

            {/* Playlist List */}
            <ScrollArea className="flex-1 px-2">
              {/* Liked Songs */}
              <div
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-white/10",
                  !selectedPlaylist && "bg-white/10"
                )}
                onClick={() => setSelectedPlaylist(null)}
              >
                <div className="w-12 h-12 rounded bg-gradient-to-br from-indigo-700 to-blue-300 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-white fill-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">Liked Songs</p>
                  <p className="text-xs text-gray-400 truncate">Playlist • {savedTracks?.length || 0} songs</p>
                </div>
              </div>

              {/* Playlists */}
              {filteredPlaylists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-white/10",
                    selectedPlaylist?.id === playlist.id && "bg-white/10"
                  )}
                  onClick={() => setSelectedPlaylist(playlist)}
                >
                  <img
                    src={playlist.images?.[0]?.url || '/placeholder-album.png'}
                    alt={playlist.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{playlist.name}</p>
                    <p className="text-xs text-gray-400 truncate">Playlist • {playlist.owner?.display_name}</p>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>

        {/* Main Content - Playlist View */}
        <div className="flex-1 bg-gradient-to-b from-[#1a1a1a] to-[#121212] overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            {selectedPlaylist ? (
              <>
                {/* Playlist Header */}
                <div className="p-6 pt-16 flex items-end gap-6 bg-gradient-to-b from-[#3a3a3a] to-transparent">
                  <img
                    src={selectedPlaylist.images?.[0]?.url || '/placeholder-album.png'}
                    alt={selectedPlaylist.name}
                    className="w-48 h-48 rounded shadow-2xl object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-white uppercase font-medium">Playlist</p>
                    <h1 className="text-5xl font-bold text-white mt-2 mb-4">{selectedPlaylist.name}</h1>
                    <p className="text-sm text-gray-300">
                      {selectedPlaylist.owner?.display_name} • {selectedPlaylist.tracks?.total || playlistTracks.length} songs
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 flex items-center gap-4">
                  <Button
                    onClick={handlePlayPlaylist}
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
                  <div className="ml-auto flex items-center gap-2 text-gray-400">
                    <span className="text-sm">List</span>
                    <List className="h-4 w-4" />
                  </div>
                </div>

                {/* Track List Header */}
                <div className="px-6 grid grid-cols-[40px_1fr_1fr_120px_60px] gap-4 text-xs text-gray-400 border-b border-white/10 pb-2">
                  <span>#</span>
                  <span>Title</span>
                  <span>Album</span>
                  <span>Date added</span>
                  <span className="text-right"><Clock className="h-4 w-4 inline" /></span>
                </div>

                {/* Track List */}
                <div className="px-6">
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
                        onClick={() => handlePlayTrack(item.track, index)}
                      >
                        <span className="text-sm text-gray-400 group-hover:hidden">{index + 1}</span>
                        <Play className="h-4 w-4 text-white hidden group-hover:block" />
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={item.track.album.images?.[0]?.url || '/placeholder-album.png'}
                            alt={item.track.album.name}
                            className="w-10 h-10 rounded"
                          />
                          <div className="min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              currentTrack?.id === item.track.id ? "text-green-500" : "text-white"
                            )}>
                              {item.track.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {item.track.artists.map(a => a.name).join(', ')}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm text-gray-400 truncate">{item.track.album.name}</span>
                        <span className="text-sm text-gray-400">{formatDate(item.added_at)}</span>
                        <span className="text-sm text-gray-400 text-right">{formatDuration(item.track.duration_ms)}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Recommended section placeholder */}
                <div className="px-6 py-8">
                  <h2 className="text-xl font-bold text-white mb-4">Recommended</h2>
                  <p className="text-sm text-gray-400">Based on what's in this playlist</p>
                </div>
              </>
            ) : (
              /* Liked Songs View */
              <>
                <div className="p-6 pt-16 flex items-end gap-6 bg-gradient-to-b from-indigo-900/50 to-transparent">
                  <div className="w-48 h-48 rounded shadow-2xl bg-gradient-to-br from-indigo-700 to-blue-300 flex items-center justify-center">
                    <Heart className="h-20 w-20 text-white fill-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-white uppercase font-medium">Playlist</p>
                    <h1 className="text-5xl font-bold text-white mt-2 mb-4">Liked Songs</h1>
                    <p className="text-sm text-gray-300">
                      {userProfile?.display_name} • {savedTracks?.length || 0} songs
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 flex items-center gap-4">
                  <Button
                    className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-transform"
                  >
                    <Play className="h-6 w-6 text-black fill-black ml-1" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                    <Shuffle className="h-6 w-6" />
                  </Button>
                </div>

                {/* Liked Songs List */}
                <div className="px-6 grid grid-cols-[40px_1fr_1fr_60px] gap-4 text-xs text-gray-400 border-b border-white/10 pb-2">
                  <span>#</span>
                  <span>Title</span>
                  <span>Album</span>
                  <span className="text-right"><Clock className="h-4 w-4 inline" /></span>
                </div>

                <div className="px-6">
                  {savedTracks?.map((track, index) => (
                    <div
                      key={track.id}
                      className={cn(
                        "grid grid-cols-[40px_1fr_1fr_60px] gap-4 py-2 px-2 -mx-2 rounded hover:bg-white/10 group cursor-pointer items-center",
                        currentTrack?.id === track.id && "bg-white/10"
                      )}
                      onClick={() => handlePlayTrack(track, index)}
                    >
                      <span className="text-sm text-gray-400 group-hover:hidden">{index + 1}</span>
                      <Play className="h-4 w-4 text-white hidden group-hover:block" />
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={track.album.images?.[0]?.url || '/placeholder-album.png'}
                          alt={track.album.name}
                          className="w-10 h-10 rounded"
                        />
                        <div className="min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            currentTrack?.id === track.id ? "text-green-500" : "text-white"
                          )}>
                            {track.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {track.artists.map(a => a.name).join(', ')}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-400 truncate">{track.album.name}</span>
                      <span className="text-sm text-gray-400 text-right">{formatDuration(track.duration_ms)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Bottom Player Bar */}
      {currentTrack && (
        <div className="h-20 bg-[#181818] border-t border-white/10 px-4 flex items-center justify-between">
          {/* Now Playing */}
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

          {/* Playback Controls */}
          <div className="flex flex-col items-center w-[40%]">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <Shuffle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.149V14.3a.7.7 0 01-.7.7H1.7a.7.7 0 01-.7-.7V1.7a.7.7 0 01.7-.7h1.6z" />
                </svg>
              </Button>
              <Button
                onClick={togglePlayPause}
                className="w-8 h-8 rounded-full bg-white hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <svg className="h-4 w-4 text-black" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z" />
                  </svg>
                ) : (
                  <Play className="h-4 w-4 text-black fill-black ml-0.5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.149V14.3a.7.7 0 00.7.7h1.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-1.6z" />
                </svg>
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 4.75A3.75 3.75 0 013.75 1h8.5A3.75 3.75 0 0116 4.75v5a3.75 3.75 0 01-3.75 3.75H9.81l1.018 1.018a.75.75 0 11-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 111.06 1.06L9.81 12h2.44a2.25 2.25 0 002.25-2.25v-5a2.25 2.25 0 00-2.25-2.25h-8.5A2.25 2.25 0 001.5 4.75v5A2.25 2.25 0 003.75 12H5v1.5H3.75A3.75 3.75 0 010 9.75v-5z" />
                </svg>
              </Button>
            </div>
            <div className="w-full max-w-md flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">0:00</span>
              <div className="flex-1 h-1 bg-gray-600 rounded-full">
                <div className="h-full w-0 bg-white rounded-full" />
              </div>
              <span className="text-xs text-gray-400">{currentTrack.duration_ms ? formatDuration(currentTrack.duration_ms) : '0:00'}</span>
            </div>
          </div>

          {/* Volume & Other Controls */}
          <div className="flex items-center gap-2 w-[30%] justify-end">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.426 2.574a2.831 2.831 0 00-4.797 1.55l3.247 3.247a2.831 2.831 0 001.55-4.797zM10.5 8.118l-2.619-2.62A63303.13 63303.13 0 004.74 9.075L2.065 12.12a1.287 1.287 0 001.816 1.816l3.06-2.688 3.56-3.129zM7.12 4.094a4.331 4.331 0 114.786 4.786l-3.974 3.493-3.06 2.689a2.787 2.787 0 01-3.933-3.933l2.676-3.045 3.505-3.99z" />
              </svg>
            </Button>
            <div className="flex items-center gap-1 w-24">
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 010 4.88z" />
              </svg>
              <div className="flex-1 h-1 bg-gray-600 rounded-full">
                <div className="h-full w-2/3 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}