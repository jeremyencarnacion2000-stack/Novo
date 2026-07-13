'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Search, Heart, Play, Pause, Loader2, AlertCircle, Music, Home, Compass, Library, PlaySquare, Mic2, Disc, SkipBack, SkipForward, Volume2, Maximize2, Clock, Users, MoreHorizontal, X, ArrowLeft, ArrowRight, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { usePlayerStore } from '@/lib/player-store'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

const DEFAULT_IMG = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=1000"

const fmtDur = (ms: number) => {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const JPOP_RECOMMENDED = [
  {
    id: "tDhP9A-1c7g",
    trackId: "tDhP9A-1c7g",
    name: "TV Animation BLEACH Original",
    title: "TV Animation BLEACH Original",
    artist: "Shiro SAGISU",
    album: "BLEACH Soundtrack",
    image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&h=400&fit=crop",
    duration_ms: 180000
  },
  {
    id: "vR1pZc71fOI",
    trackId: "vR1pZc71fOI",
    name: "Replay de Japón",
    title: "Replay de Japón",
    artist: "Mrs. GREEN APPLE, YOASOBI, Ado y más",
    album: "Replay de Japón",
    image: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400&h=400&fit=crop",
    duration_ms: 220000
  },
  {
    id: "m88m2fB5h8c",
    trackId: "m88m2fB5h8c",
    name: "Reiwa Era J-Pop",
    title: "Reiwa Era J-Pop",
    artist: "Mrs. GREEN APPLE, King Gnu, Yorushika...",
    album: "Reiwa Era J-Pop",
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=400&fit=crop",
    duration_ms: 240000
  },
  {
    id: "SX_ViT4Ra7k",
    trackId: "SX_ViT4Ra7k",
    name: "Karaoke de J-Pop",
    title: "Karaoke de J-Pop",
    artist: "Kenshi Yonezu, Mrs. GREEN APPLE...",
    album: "Karaoke J-Pop",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=400&fit=crop",
    duration_ms: 200000
  },
  {
    id: "UyHMw3-fVfI",
    trackId: "UyHMw3-fVfI",
    name: "애니ost",
    title: "애니ost",
    artist: "Various Artists",
    album: "Anime Compilation",
    image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=400&fit=crop",
    duration_ms: 215000,
    views: "2.8 K vistas"
  },
  {
    id: "pAsm3U1g0Z4",
    trackId: "pAsm3U1g0Z4",
    name: "CHAINSAW MAN THE MOVIE: REZE",
    title: "CHAINSAW MAN THE MOVIE: REZE",
    artist: "kensuke ushio",
    album: "Chainsaw Man OST",
    image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?w=400&h=400&fit=crop",
    duration_ms: 195000
  }
]

const ALBUMS_FOR_YOU = [
  {
    id: "sOnqjkJTMaA",
    trackId: "sOnqjkJTMaA",
    name: "Thriller",
    title: "Thriller",
    artist: "Michael Jackson",
    album: "Thriller",
    image: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&h=400&fit=crop",
    duration_ms: 357000
  },
  {
    id: "VcjzHMhBtf0",
    trackId: "VcjzHMhBtf0",
    name: "DON'T STOP",
    title: "DON'T STOP",
    artist: "EP",
    album: "DON'T STOP",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
    duration_ms: 180000
  },
  {
    id: "y83x7MgzWOA",
    trackId: "y83x7MgzWOA",
    name: "All This To Say I Love You",
    title: "All This To Say I Love You",
    artist: "Various",
    album: "All This To Say",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
    duration_ms: 240000
  },
  {
    id: "3PEGDGxZu_M",
    trackId: "3PEGDGxZu_M",
    name: "this is what ___ feels like (Vol. 1-4)",
    title: "this is what ___ feels like (Vol. 1-4)",
    artist: "Various",
    album: "Compilation",
    image: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&h=400&fit=crop",
    duration_ms: 280000
  },
  {
    id: "1T1XW2z9Hic",
    trackId: "1T1XW2z9Hic",
    name: "En El Lugar Secreto Sesion Acustica",
    title: "En El Lugar Secreto Sesion Acustica",
    artist: "Acoustic Session",
    album: "En El Lugar Secreto",
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=400&fit=crop",
    duration_ms: 310000
  },
  {
    id: "u3_0e8V5_30",
    trackId: "u3_0e8V5_30",
    name: "Ante Tu Altar (Tour Edition)",
    title: "Ante Tu Altar (Tour Edition)",
    artist: "Live",
    album: "Ante Tu Altar",
    image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=400&fit=crop",
    thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=400&fit=crop",
    duration_ms: 290000
  }
]

export default function MusicPage() {
  const { data: session } = useSession()
  
  // View navigation states
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'albums' | 'artists' | 'liked-songs' | string>('home')
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)
  const [navHistory, setNavHistory] = useState<string[]>(['home'])
  const [historyIndex, setHistoryIndex] = useState(0)

  // Music Data states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trendingTracks, setTrending] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [topArtists, setTopArtists] = useState<any[]>([])
  
  // Custom Playlists & Likes state
  const [customPlaylists, setCustomPlaylists] = useState<any[]>([])
  const [likedSongs, setLikedSongs] = useState<any[]>([])
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set())
  const [followedArtistIds, setFollowedArtistIds] = useState<Set<string>>(new Set())
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('')

  // UI Dropdown/Overlay state
  const [activeTrackMenuId, setActiveTrackMenuId] = useState<string | null>(null)
  const [isCompanionMenuOpen, setIsCompanionMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const companionMenuRef = useRef<HTMLDivElement>(null)
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])

  // Selected Artist profile data
  const [artistLoading, setArtistLoading] = useState(false)
  const [artistData, setArtistData] = useState<any | null>(null)

  const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([])

  const jpopScrollRef = useRef<HTMLDivElement>(null)
  const albumsScrollRef = useRef<HTMLDivElement>(null)
  const recentScrollRef = useRef<HTMLDivElement>(null)

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const amount = direction === 'left' ? -480 : 480
      ref.current.scrollBy({ left: amount, behavior: 'smooth' })
    }
  }

  const { playTrack, togglePlayPause, currentTrack, isPlaying } = usePlayerStore()

  // Load home recommendations
  const loadHomeData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/ytmusic/home')
      if (res.ok) {
        const d = await res.json()
        setTrending(d.topTracks || [])
        setPlaylists(d.playlists || [])
        setTopArtists(d.topArtists || [])
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to load music data')
      }
    } catch (e: any) { 
      setError(e.message || 'Network error loading music data')
    } finally { 
      setLoading(false) 
    }
  }

  // Load custom user playlists & liked songs
  const loadUserData = async () => {
    if (!session) return
    try {
      // Parallel load
      const [playlistsRes, likedRes, followRes, historyRes] = await Promise.all([
        fetch('/api/music/playlists'),
        fetch('/api/music/liked'),
        fetch('/api/music/follow'),
        fetch('/api/music/history')
      ])
      
      if (playlistsRes.ok) {
        const playlistsData = await playlistsRes.json()
        setCustomPlaylists(playlistsData || [])
      }
      
      if (likedRes.ok) {
        const likedData = await likedRes.json()
        setLikedSongs(likedData || [])
        setLikedTrackIds(new Set((likedData || []).map((t: any) => t.trackId)))
      }

      if (followRes.ok) {
        const followData = await followRes.json()
        setFollowedArtistIds(new Set((followData || []).map((a: any) => a.artistId)))
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setRecentlyPlayed(historyData || [])
      }
    } catch (e) {
      console.error("Failed to load user custom music data:", e)
    }
  }

  // Follow/Unfollow artist
  const toggleFollowArtist = async (artistId: string, artistName: string, imageUrl: string) => {
    if (!session) return
    
    const isFollowing = followedArtistIds.has(artistId)
    const newFollowed = new Set(followedArtistIds)
    if (isFollowing) {
      newFollowed.delete(artistId)
    } else {
      newFollowed.add(artistId)
    }
    // Optimistic UI update
    setFollowedArtistIds(newFollowed)

    try {
      const res = await fetch('/api/music/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          artistName,
          imageUrl: imageUrl || DEFAULT_IMG,
          action: isFollowing ? 'unfollow' : 'follow'
        })
      })

      if (!res.ok) {
        // Rollback on error
        const rolledBack = new Set(followedArtistIds)
        setFollowedArtistIds(rolledBack)
        console.error("Failed to toggle follow status")
      } else {
        // Refresh home data since topArtists now includes or excludes followed artists
        loadHomeData()
      }
    } catch (e) {
      // Rollback on error
      const rolledBack = new Set(followedArtistIds)
      setFollowedArtistIds(rolledBack)
      console.error("Failed to toggle follow status:", e)
    }
  }

  useEffect(() => {
    loadHomeData()
  }, [])

  useEffect(() => {
    if (session) {
      loadUserData()
    }
  }, [session])

  // Load selected artist profile details
  const loadArtistProfile = async (id: string) => {
    try {
      setArtistLoading(true)
      const res = await fetch(`/api/ytmusic/artist/${id}`)
      if (res.ok) {
        const d = await res.json()
        setArtistData(d)
      } else {
        console.error('Failed to load artist details')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setArtistLoading(false)
    }
  }

  useEffect(() => {
    if (selectedArtistId) {
      loadArtistProfile(selectedArtistId)
    } else {
      setArtistData(null)
    }
  }, [selectedArtistId])

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveTrackMenuId(null)
      }
      if (companionMenuRef.current && !companionMenuRef.current.contains(e.target as Node)) {
        setIsCompanionMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return 
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`)
        const d = await res.json()
        if (res.ok) {
          setSearchResults(d.tracks || [])
        } else {
          console.error('Search error:', d.error)
          setSearchResults([])
        }
      } catch (e: any) { console.error(e); setSearchResults([]) }
      finally { setSearching(false) }
    }, 600)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Navigation history manager
  const navigateTo = (view: string) => {
    const newHistory = navHistory.slice(0, historyIndex + 1)
    newHistory.push(view)
    setNavHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)

    if (view.startsWith('artist:')) {
      const id = view.replace('artist:', '')
      setSelectedArtistId(id)
    } else {
      setSelectedArtistId(null)
      setActiveTab(view)
    }
  }

  const navigateBack = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1
      setHistoryIndex(prevIndex)
      const view = navHistory[prevIndex]
      if (view.startsWith('artist:')) {
        const id = view.replace('artist:', '')
        setSelectedArtistId(id)
      } else {
        setSelectedArtistId(null)
        setActiveTab(view)
      }
    }
  }

  const navigateForward = () => {
    if (historyIndex < navHistory.length - 1) {
      const nextIndex = historyIndex + 1
      setHistoryIndex(nextIndex)
      const view = navHistory[nextIndex]
      if (view.startsWith('artist:')) {
        const id = view.replace('artist:', '')
        setSelectedArtistId(id)
      } else {
        setSelectedArtistId(null)
        setActiveTab(view)
      }
    }
  }

  const handlePlay = (t: any, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const songId = t.trackId || t.id
    if (!songId) return

    const songName = t.name || t.title
    const songArtist = t.artists?.[0]?.name || t.artist || t.owner || 'Unknown'
    const songArtistId = t.artists?.[0]?.id || t.artistId || ''
    const songThumbnail = t.image || t.thumbnail || DEFAULT_IMG

    if (currentTrack?.id === songId) {
      togglePlayPause()
      return
    }

    // Play track globally
    playTrack({
      id: songId,
      uri: songId,
      name: songName,
      artist: songArtist,
      image: (songThumbnail).replace('w120-h120', 'w1000-h1000'),
      duration_ms: t.duration_ms || t.duration || 240000
    })

    // Log history entry optimistically
    const optimisticEntry = {
      id: songId + '-' + Date.now(),
      trackId: songId,
      title: songName,
      artist: songArtist,
      artistId: songArtistId,
      thumbnail: songThumbnail,
      playedAt: new Date().toISOString()
    }

    setRecentlyPlayed(prev => {
      // Filter out duplicate track plays
      const filtered = prev.filter(item => (item.trackId || item.id) !== songId)
      return [optimisticEntry, ...filtered].slice(0, 20)
    })

    // POST to database history API
    if (session) {
      fetch('/api/music/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: songId,
          title: songName,
          artist: songArtist,
          artistId: songArtistId,
          thumbnail: songThumbnail
        })
      }).catch(err => console.error("Failed to post to history API:", err))
    }
  }

  // Toggle Like Track logic
  const handleToggleLike = async (track: any, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const songId = track.trackId || track.id
    const isLiked = likedTrackIds.has(songId)
    const action = isLiked ? 'remove' : 'add'
    
    // Update local state optimistically
    const updatedIds = new Set(likedTrackIds)
    if (isLiked) {
      updatedIds.delete(songId)
      setLikedSongs(prev => prev.filter(t => t.trackId !== songId))
    } else {
      updatedIds.add(songId)
      const newLike = {
        trackId: songId,
        title: track.name || track.title,
        artist: track.artists?.[0]?.name || track.artist || 'Unknown',
        artistId: track.artists?.[0]?.id || track.artistId || '',
        thumbnail: track.image || track.thumbnail || DEFAULT_IMG,
        duration: track.duration_ms || track.duration || 240000
      }
      setLikedSongs(prev => [newLike, ...prev])
    }
    setLikedTrackIds(updatedIds)

    try {
      await fetch('/api/music/liked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: songId,
          action,
          title: track.name || track.title,
          artist: track.artists?.[0]?.name || track.artist || 'Unknown',
          artistId: track.artists?.[0]?.id || track.artistId || '',
          thumbnail: track.image || track.thumbnail || DEFAULT_IMG,
          duration: track.duration_ms || track.duration || 240000
        })
      })
    } catch (error) {
      console.error('Error toggling like track:', error)
    }
  }

  // Playlist management functions
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return
    try {
      const res = await fetch('/api/music/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaylistName,
          description: newPlaylistDesc,
          tracks: []
        })
      })
      if (res.ok) {
        const newPl = await res.json()
        setCustomPlaylists(prev => [newPl, ...prev])
        setNewPlaylistName('')
        setNewPlaylistDesc('')
        setIsCreatePlaylistOpen(false)
        navigateTo(`playlist:${newPl.id}`)
      }
    } catch (error) {
      console.error('Failed to create playlist:', error)
    }
  }

  const handleAddTrackToPlaylist = async (playlistId: string, track: any) => {
    const playlist = customPlaylists.find(p => p.id === playlistId)
    if (!playlist) return
    
    const currentTracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
    const trackIdToAdd = track.id || track.trackId
    if (currentTracks.some((t: any) => (t.id || t.trackId) === trackIdToAdd)) {
      setActiveTrackMenuId(null)
      return
    }

    const updatedTracks = [...currentTracks, {
      id: trackIdToAdd,
      name: track.name || track.title,
      artist: track.artists?.[0]?.name || track.artist || 'Unknown',
      artistId: track.artists?.[0]?.id || track.artistId || '',
      image: track.image || track.thumbnail || DEFAULT_IMG,
      duration_ms: track.duration_ms || track.duration || 240000
    }]

    // Update state optimistically
    setCustomPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, tracks: updatedTracks } : p))
    setActiveTrackMenuId(null)

    try {
      await fetch(`/api/music/playlists/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: updatedTracks })
      })
    } catch (e) {
      console.error('Failed to add track to playlist:', e)
    }
  }

  const handleRemoveTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    const playlist = customPlaylists.find(p => p.id === playlistId)
    if (!playlist) return

    const currentTracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
    const updatedTracks = currentTracks.filter((t: any) => (t.id || t.trackId) !== trackId)

    // Update state
    setCustomPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, tracks: updatedTracks } : p))

    try {
      await fetch(`/api/music/playlists/${playlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: updatedTracks })
      })
    } catch (e) {
      console.error('Failed to remove track from playlist:', e)
    }
  }

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return
    try {
      const res = await fetch(`/api/music/playlists/${playlistId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setCustomPlaylists(prev => prev.filter(p => p.id !== playlistId))
        navigateTo('home')
      }
    } catch (e) {
      console.error('Failed to delete playlist:', e)
    }
  }

  const isCurrentTrackPlaying = (id: string) => currentTrack?.id === id && isPlaying

  // Right sidebar details helper
  const rightSidebarFeatured = artistData || topArtists[0] || playlists[0] || trendingTracks[0] || null
  const nextInQueueTrack = trendingTracks[1] || null

  // Companion track for the popular right panel
  const companionTrack = currentTrack ? {
    id: currentTrack.id,
    trackId: currentTrack.id,
    name: currentTrack.name,
    title: currentTrack.name,
    artist: currentTrack.artist,
    image: currentTrack.image,
    thumbnail: currentTrack.image,
    duration: currentTrack.duration_ms
  } : rightSidebarFeatured && rightSidebarFeatured.topSongs?.[0] ? {
    id: rightSidebarFeatured.topSongs[0].id,
    trackId: rightSidebarFeatured.topSongs[0].id,
    name: rightSidebarFeatured.topSongs[0].name || rightSidebarFeatured.topSongs[0].title,
    title: rightSidebarFeatured.topSongs[0].name || rightSidebarFeatured.topSongs[0].title,
    artist: rightSidebarFeatured.name,
    image: rightSidebarFeatured.topSongs[0].image || rightSidebarFeatured.topSongs[0].thumbnail || rightSidebarFeatured.image,
    thumbnail: rightSidebarFeatured.topSongs[0].image || rightSidebarFeatured.topSongs[0].thumbnail || rightSidebarFeatured.image,
    duration: rightSidebarFeatured.topSongs[0].duration_ms || rightSidebarFeatured.topSongs[0].duration
  } : null

  // Active playlist computation
  const activePlaylist = activeTab.startsWith('playlist:') 
    ? customPlaylists.find(p => p.id === activeTab.replace('playlist:', '')) 
    : null

  /* ─── Track Row Component ─── */
  const TrackRow = ({ track, i, onClick }: { track: any; i: number; onClick: (t: any, e?: React.MouseEvent) => void }) => {
    const songId = track.id || track.trackId
    const name = track.name || track.title

    // Correct mapping for track artists, supporting both searches, followed, and liked tracks!
    const artistObject = track.artists?.[0] || { name: track.artist || 'Unknown', id: track.artistId || null }

    const isLiked = likedTrackIds.has(songId)

    return (
      <div
        key={songId + i}
        onDoubleClick={(e) => onClick(track, e)}
        className="group flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer text-[#b3b3b3] hover:text-white relative"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center justify-center w-6 shrink-0">
            <span className={cn("text-sm font-semibold tabular-nums group-hover:hidden", isCurrentTrackPlaying(songId) && "hidden")}>
              {i + 1}
            </span>
            {isCurrentTrackPlaying(songId) ? (
              <Pause onClick={(e) => onClick(track, e)} className="h-4 w-4 text-[#1db954] group-hover:block" />
            ) : (
              <Play onClick={(e) => onClick(track, e)} className="h-4 w-4 text-white hidden group-hover:block fill-white" />
            )}
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/20 shrink-0">
              <img loading="lazy" src={track.image || track.thumbnail || DEFAULT_IMG} className="w-full h-full object-cover" alt="" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-semibold truncate", currentTrack?.id === songId ? "text-[#1db954]" : "text-white")}>{name}</p>
              
              {/* Dynamic Artist Link! Clicking here opens their dynamic profile, regardless of whether you follow them or not! */}
              <p 
                onClick={(e) => {
                  e.stopPropagation()
                  if (artistObject.id) {
                    navigateTo(`artist:${artistObject.id}`)
                  }
                }}
                className={cn("text-[12px] text-[#b3b3b3] hover:underline hover:text-white truncate", artistObject.id && "cursor-pointer")}
              >
                {artistObject.name}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 shrink-0">
          <Heart 
            onClick={(e) => handleToggleLike(track, e)}
            className={cn(
              "h-4 w-4 transition-all hover:scale-115 cursor-pointer",
              isLiked ? "text-[#1db954] fill-[#1db954] opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100 hover:text-[#1db954]"
            )} 
          />
          <span className="text-sm tabular-nums opacity-85">
            {track.duration_ms ? fmtDur(track.duration_ms) : track.duration ? fmtDur(track.duration) : '3:45'}
          </span>
          
          {/* Options Dropdown button */}
          <div className="relative">
            <MoreHorizontal 
              onClick={(e) => {
                e.stopPropagation()
                setActiveTrackMenuId(activeTrackMenuId === songId ? null : songId)
              }} 
              className="h-4 w-4 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer hover:text-white"
            />
            {activeTrackMenuId === songId && (
              <div 
                ref={menuRef}
                className="absolute right-0 mt-2 w-48 bg-[#1e201b]/95 backdrop-blur-2xl border border-white/10 rounded-xl py-1 shadow-2xl z-50 overflow-hidden"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5">Options</div>
                
                {/* Playlist list for adding tracks */}
                {customPlaylists.length > 0 ? (
                  <div className="py-1">
                    <p className="px-3 py-1 text-[11px] font-semibold text-[#b3b3b3]">Add to Playlist:</p>
                    {customPlaylists.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddTrackToPlaylist(p.id, track)}
                        className="w-full text-left px-4 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors truncate"
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setActiveTrackMenuId(null)
                      setIsCreatePlaylistOpen(true)
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-white/85 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    + Create Playlist first
                  </button>
                )}

                {activePlaylist && (
                  <button
                    onClick={() => {
                      handleRemoveTrackFromPlaylist(activePlaylist.id, songId)
                      setActiveTrackMenuId(null)
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-white/10 transition-colors border-t border-white/5"
                  >
                    Remove from playlist
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 p-0 sm:p-4 lg:p-6 flex flex-col justify-between bg-transparent">
      {/* ─── FLOATING MAIN CONTAINER ─── */}
      <div className="w-full h-full bg-[#151713]/85 backdrop-blur-2xl border-0 sm:border sm:border-white/10 rounded-none sm:rounded-[28px] flex overflow-hidden shadow-2xl relative">
        
        {/* ─── LEFT SIDEBAR ─── */}
        <div className="w-[240px] bg-black/35 border-r border-white/5 flex flex-col hidden lg:flex shrink-0 p-5">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6 px-1 cursor-pointer" onClick={() => navigateTo('home')}>
            <div className="w-8 h-8 rounded-full bg-[#1db954] flex items-center justify-center shadow-[0_0_15px_rgba(29,185,84,0.3)]">
              <Music className="h-4 w-4 text-black" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Novo Music</span>
          </div>

          {/* Search bar inside Sidebar */}
          <div className="relative w-full mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b3b3b3]" />
            <input
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 h-10 text-sm text-white placeholder:text-[#b3b3b3]/60 focus:outline-none focus:ring-1 focus:ring-white/10 focus:bg-black/25 transition-all shadow-inner"
            />
          </div>

          <ScrollArea className="flex-1 px-1">
            <nav className="space-y-1 mb-6">
              <p className="text-[11px] font-bold text-[#b3b3b3]/50 uppercase tracking-widest mb-2 px-3">Menu</p>
              {[
                { id: 'home', icon: Home, label: 'Home' },
                { id: 'discover', icon: Compass, label: 'Discover' },
                { id: 'albums', icon: Disc, label: 'Albums' },
                { id: 'artists', icon: Mic2, label: 'Artists' },
              ].map(({ id, icon: Icon, label }) => (
                <div 
                  key={id} 
                  onClick={() => navigateTo(id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-all",
                    activeTab === id && !selectedArtistId ? "bg-white/10 text-white shadow-sm" : "text-[#b3b3b3] hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </div>
              ))}
            </nav>
            
            <nav className="space-y-1 mb-6">
              <div className="flex items-center justify-between mb-2 px-3">
                <p className="text-[11px] font-bold text-[#b3b3b3]/50 uppercase tracking-widest">Library</p>
                <Plus 
                  onClick={() => setIsCreatePlaylistOpen(true)}
                  className="h-4 w-4 text-[#b3b3b3] hover:text-white cursor-pointer hover:scale-110 transition-transform" 
                />
              </div>
              
              <div 
                onClick={() => navigateTo('liked-songs')}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-all",
                  activeTab === 'liked-songs' && !selectedArtistId ? "bg-white/10 text-white shadow-sm" : "text-[#b3b3b3] hover:text-white hover:bg-white/5"
                )}
              >
                <Heart className="h-4 w-4 text-[#1db954] fill-[#1db954]" /> Liked Songs
              </div>
            </nav>

            {/* Custom user playlists in sidebar */}
            {customPlaylists.length > 0 && (
              <nav className="space-y-1">
                <p className="text-[11px] font-bold text-[#b3b3b3]/50 uppercase tracking-widest mb-2 px-3">Playlists</p>
                {customPlaylists.map(pl => (
                  <div
                    key={pl.id}
                    onClick={() => navigateTo(`playlist:${pl.id}`)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-all truncate",
                      activeTab === `playlist:${pl.id}` && !selectedArtistId ? "bg-white/10 text-white shadow-sm" : "text-[#b3b3b3] hover:text-white hover:bg-white/5"
                    )}
                  >
                    <PlaySquare className="h-4 w-4 shrink-0 text-[#1db954]" />
                    <span className="truncate">{pl.name}</span>
                  </div>
                ))}
              </nav>
            )}
          </ScrollArea>
        </div>

        {/* ─── MIDDLE CONTENT AREA ─── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-transparent relative">

          {/* ─── MOBILE TOP NAV (hidden on lg+) ─── */}
          <div className="flex lg:hidden flex-col shrink-0 border-b border-white/5 bg-[#151713]/60">
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#b3b3b3] pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search music..."
                  className="w-full bg-white/5 border border-white/5 rounded-full pl-9 pr-4 h-9 text-sm text-white placeholder:text-[#b3b3b3]/60 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
                />
              </div>
              <button
                onClick={() => setIsCreatePlaylistOpen(true)}
                className="w-9 h-9 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
                title="New playlist"
              >
                <Plus className="h-4 w-4 text-[#b3b3b3]" />
              </button>
            </div>
            {/* Library grid — fixed categories get their own uncluttered row
                of tiles instead of being crammed into one long horizontal
                scroll strip alongside every custom playlist. */}
            {/* pr-20 (not px-3 on both sides): the global floating
                notifications button sits `fixed top-16 right-4` at ~48px
                wide, right in the top-right corner this row would otherwise
                reach — the extra right clearance keeps the last tile from
                landing under it. */}
            <div className="grid grid-cols-5 gap-1.5 pl-3 pr-20 pb-2.5">
              {[
                { id: 'home', icon: Home, label: 'Home' },
                { id: 'discover', icon: Compass, label: 'Discover' },
                { id: 'liked-songs', icon: Heart, label: 'Liked' },
                { id: 'albums', icon: Disc, label: 'Albums' },
                { id: 'artists', icon: Mic2, label: 'Artists' },
              ].map(({ id, icon: Icon, label }) => {
                const isActive = activeTab === id && !selectedArtistId
                return (
                  <button
                    key={id}
                    onClick={() => navigateTo(id)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-semibold transition-all',
                      isActive
                        ? 'bg-white/10 text-white border border-white/15'
                        : 'bg-white/[0.03] border border-white/5 text-[#b3b3b3] hover:text-white hover:bg-white/5'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate w-full text-center leading-none">{label}</span>
                  </button>
                )
              })}
            </div>

            {/* Custom playlists — separate horizontal strip, only rendered when there are any */}
            {customPlaylists.length > 0 && (
              <div className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {customPlaylists.map(pl => {
                  const id = `playlist:${pl.id}`
                  const isActive = activeTab === id && !selectedArtistId
                  return (
                    <button
                      key={id}
                      onClick={() => navigateTo(id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                        isActive
                          ? 'bg-white/10 text-white border border-white/15'
                          : 'text-[#b3b3b3] hover:text-white hover:bg-white/5'
                      )}
                    >
                      <PlaySquare className="h-3 w-3 shrink-0 text-[#1db954]" />
                      {pl.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top navigation breadcrumbs — desktop only */}
          <div className="h-16 px-8 hidden lg:flex items-center gap-4 shrink-0 z-10 bg-transparent">
            <div className="flex items-center gap-2">
              <button 
                onClick={navigateBack}
                disabled={historyIndex === 0}
                className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4 text-white" />
              </button>
              <button 
                onClick={navigateForward}
                disabled={historyIndex >= navHistory.length - 1}
                className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowRight className="h-4 w-4 text-white" />
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-semibold text-[#b3b3b3]">
              <span className="hover:text-white cursor-pointer" onClick={() => navigateTo('home')}>Home</span>
              <span className="opacity-40">/</span>
              {selectedArtistId ? (
                <>
                  <span className="hover:text-white cursor-pointer" onClick={() => navigateTo('artists')}>Artists</span>
                  <span className="opacity-40">/</span>
                  <span className="text-white truncate max-w-[120px]">{artistData?.name || 'Artist Profile'}</span>
                </>
              ) : activePlaylist ? (
                <>
                  <span className="hover:text-white cursor-pointer" onClick={() => navigateTo('home')}>Playlists</span>
                  <span className="opacity-40">/</span>
                  <span className="text-white truncate max-w-[120px]">{activePlaylist.name}</span>
                </>
              ) : (
                <span className="text-white uppercase tracking-wider text-[10px]">{activeTab}</span>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-4 sm:px-6 lg:px-8 pb-32">
              {error && (
                <div className="p-3 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-200 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <p>{error}</p>
                </div>
              )}

              {/* ─── LOADING STATE ─── */}
              {loading || (selectedArtistId && artistLoading) ? (
                <div className="flex items-center justify-center py-40">
                  <Loader2 className="h-10 w-10 animate-spin text-[#1db954]" />
                </div>
              ) : searchQuery ? (
                /* ─── SEARCH RESULTS TAB ─── */
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Search Results</h2>
                  {searching ? (
                    <div className="flex items-center gap-3 text-[#b3b3b3] py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-[#1db954]" />
                      <span>Searching...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-0.5">
                      {searchResults.map((track, i) => (
                        <TrackRow key={track.id + i} track={track} i={i} onClick={handlePlay} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#b3b3b3] py-8 font-medium">No results found for &quot;{searchQuery}&quot;</p>
                  )}
                </div>
              ) : selectedArtistId && artistData ? (
                /* ─── DYNAMIC ARTIST PROFILE VIEW ─── */
                <div>
                  <div className="bg-[#0b0c0a]/90 rounded-[28px] p-8 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden border border-white/5 shadow-2xl mb-8 group min-h-[220px]">
                    {/* Left details */}
                    <div className="relative z-10 max-w-xl">
                      <div className="flex items-center gap-2 mb-4 bg-white/5 border border-white/10 rounded-full py-1.5 px-3.5 w-fit">
                        <svg className="w-4 h-4 text-[#3d91f4]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        <span className="text-[11px] font-bold text-white/95 uppercase tracking-widest">Verified Artist</span>
                      </div>
                      <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter leading-none">{artistData.name}</h1>
                      
                      <div className="flex items-center gap-2 mb-6 text-sm font-semibold text-[#b3b3b3]">
                        <Users className="h-4 w-4" />
                        <span>{((artistData.name.charCodeAt(0) * 876) % 80 + 10).toFixed(1)}M listeners</span>
                      </div>

                      {/* Action buttons inside the card */}
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={(e) => {
                            if (artistData.topSongs?.[0]) {
                              handlePlay(artistData.topSongs[0], e)
                            }
                          }}
                          className="flex items-center justify-center gap-2 bg-[#1db954] hover:bg-[#1ed760] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-105 transition-all shadow-lg active:scale-95"
                        >
                          <Play className="h-4 w-4 fill-black ml-0.5" />
                          <span>Play Popular</span>
                        </button>
                        <button 
                          onClick={() => toggleFollowArtist(artistData.id, artistData.name, artistData.thumbnails?.[0]?.url || DEFAULT_IMG)}
                          className={cn(
                            "font-bold text-sm px-6 py-3 rounded-full hover:scale-105 transition-all active:scale-95 border",
                            followedArtistIds.has(artistData.id) 
                              ? "bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white"
                              : "bg-white text-black border-transparent hover:bg-white/90"
                          )}
                        >
                          {followedArtistIds.has(artistData.id) ? '✓ Following' : '+ Follow'}
                        </button>
                      </div>
                    </div>

                    {/* Right cut-out style image */}
                    <div className="absolute right-0 bottom-0 top-0 w-1/2 hidden md:block z-0">
                      <img loading="lazy" src={artistData.thumbnails?.[artistData.thumbnails.length - 1]?.url || DEFAULT_IMG} className="w-full h-full object-cover object-center opacity-85" alt="" />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c0a] via-[#0b0c0a]/40 to-transparent" />
                    </div>
                  </div>

                  {/* Popular Songs list */}
                  <section className="mb-10">
                    <h2 className="text-xl font-bold text-white mb-4 px-2 tracking-tight">Popular Songs</h2>
                    <div className="space-y-0.5">
                      {artistData.topSongs?.slice(0, 8).map((track: any, i: number) => (
                        <TrackRow key={track.id + i} track={track} i={i} onClick={handlePlay} />
                      ))}
                    </div>
                  </section>

                  {/* Similar Artists section */}
                  {artistData.similarArtists?.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold text-white mb-4 px-2 tracking-tight">Fans Also Like</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {artistData.similarArtists.slice(0, 5).map((sa: any) => (
                          <div 
                            key={sa.id}
                            onClick={() => navigateTo(`artist:${sa.id}`)}
                            className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center hover:bg-white/[0.07] transition-all cursor-pointer group"
                          >
                            <div className="w-24 h-24 rounded-full overflow-hidden mb-3 shadow-md relative">
                              <img loading="lazy" src={sa.image || DEFAULT_IMG} className="w-full h-full object-cover" alt="" />
                              <button className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="h-6 w-6 text-white fill-white" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-white truncate w-full group-hover:text-[#1db954] transition-colors">{sa.name}</span>
                            <span className="text-[10px] text-[#b3b3b3] mt-1">Artist</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : activeTab === 'liked-songs' ? (
                /* ─── LIKED SONGS VIEW TAB ─── */
                <div>
                  <div className="bg-gradient-to-r from-rose-950/70 to-pink-950/40 border border-rose-500/10 rounded-[28px] p-8 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shadow-2xl mb-8 min-h-[200px]">
                    <div className="relative z-10 max-w-xl">
                      <div className="w-12 h-12 rounded-2xl bg-rose-500 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/20">
                        <Heart className="h-6 w-6 text-black fill-black" />
                      </div>
                      <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">Liked Songs</h1>
                      <p className="text-sm text-[#b3b3b3]">Your private library of high-fidelity songs and soundtracks.</p>
                    </div>
                  </div>

                  {likedSongs.length > 0 ? (
                    <div className="space-y-0.5 bg-white/[0.01] border border-white/5 rounded-2xl p-3">
                      {likedSongs.map((track, i) => (
                        <TrackRow key={track.trackId || track.id} track={track} i={i} onClick={handlePlay} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Heart className="h-12 w-12 text-rose-500 mb-4" />
                      <p className="text-[#b3b3b3] text-sm">You haven&apos;t liked any songs yet.</p>
                      <button 
                        onClick={() => navigateTo('home')}
                        className="mt-4 px-6 py-2 rounded-full border border-white/20 hover:border-white text-white text-xs font-bold transition-all"
                      >
                        Explore Songs
                      </button>
                    </div>
                  )}
                </div>
              ) : activePlaylist ? (
                /* ─── CUSTOM PLAYLIST VIEW TAB ─── */
                <div>
                  <div className="bg-gradient-to-r from-purple-950/70 to-indigo-950/40 border border-purple-500/10 rounded-[28px] p-8 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden shadow-2xl mb-8 min-h-[220px]">
                    <div className="relative z-10 max-w-xl">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                        <PlaySquare className="h-6 w-6 text-black" />
                      </div>
                      <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">{activePlaylist.name}</h1>
                      <p className="text-sm text-[#b3b3b3] mb-6">{activePlaylist.description || 'No description provided.'}</p>
                      
                      <div className="flex items-center gap-4">
                        {activePlaylist.tracks?.length > 0 && (
                          <button 
                            onClick={() => handlePlay(activePlaylist.tracks[0])}
                            className="flex items-center justify-center gap-2 bg-[#1db954] hover:bg-[#1ed760] text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-105 transition-all shadow-lg"
                          >
                            <Play className="h-4 w-4 fill-black ml-0.5" />
                            <span>Play Playlist</span>
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeletePlaylist(activePlaylist.id)}
                          className="flex items-center justify-center gap-2 border border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-500/50 font-semibold text-xs px-4 py-2.5 rounded-full transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete Playlist</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {activePlaylist.tracks && activePlaylist.tracks.length > 0 ? (
                    <div className="space-y-0.5 bg-white/[0.01] border border-white/5 rounded-2xl p-3">
                      {activePlaylist.tracks.map((track: any, i: number) => (
                        <TrackRow key={(track.id || track.trackId) + i} track={track} i={i} onClick={handlePlay} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center bg-white/[0.01] border border-white/5 rounded-[28px] p-8">
                      <Music className="h-12 w-12 text-purple-500 mb-4" />
                      <p className="text-[#b3b3b3] text-sm mb-2">This playlist is empty.</p>
                      <p className="text-xs text-[#b3b3b3]/60 max-w-xs">Use the Search box or home sections, click the three dots on any track, and select this playlist to add songs!</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'home' ? (
                /* ─── HOME VIEW TAB (Perfect Adaptability!) ─── */
                <div className="space-y-8">
                  {/* Big Welcoming Hero Card */}
                  <div className="bg-gradient-to-r from-emerald-950/70 to-teal-950/40 border border-emerald-500/10 rounded-[28px] p-8 flex flex-col justify-end min-h-[220px] shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
                    <div className="relative z-10 max-w-xl">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Editor's Pick</p>
                      <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">Welcome to Novo Music</h1>
                      <p className="text-sm text-[#b3b3b3] mb-6">Enjoy clean spatial sound and high-fidelity streaming directly within your hub workspace.</p>
                      <button 
                        onClick={() => {
                          if (trendingTracks[0]) handlePlay(trendingTracks[0])
                        }} 
                        className="bg-white hover:bg-neutral-100 text-black font-bold text-sm px-6 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md"
                      >
                        Listen Now
                      </button>
                    </div>
                  </div>

                  {/* Pop japonés (Recomendadas J-Pop) */}
                  <section className="relative">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h2 className="text-xl font-bold text-white tracking-tight">Pop japonés</h2>
                      <div className="flex items-center gap-2">
                        <button className="text-xs bg-white/5 hover:bg-white/10 text-white font-bold py-1 px-3 rounded-full transition-all border border-white/5">Más</button>
                        <button 
                          onClick={() => scrollContainer(jpopScrollRef, 'left')} 
                          className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/60 transition-colors"
                        >
                          <ArrowLeft className="h-4 w-4 text-white" />
                        </button>
                        <button 
                          onClick={() => scrollContainer(jpopScrollRef, 'right')} 
                          className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/60 transition-colors"
                        >
                          <ArrowRight className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                    <div 
                      ref={jpopScrollRef}
                      className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {JPOP_RECOMMENDED.map((track) => (
                        <div 
                          key={track.id}
                          onClick={() => handlePlay(track)}
                          className="w-[140px] sm:w-[180px] shrink-0 bg-white/[0.02] border border-white/5 rounded-2xl p-3 hover:bg-white/[0.07] transition-all cursor-pointer group shadow-sm snap-start relative"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden mb-3 shadow-md relative">
                            <img loading="lazy" src={track.image} className="w-full h-full object-cover" alt={track.name} />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="w-12 h-12 rounded-full bg-[#1db954] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg">
                                <Play className="h-5 w-5 text-black fill-black ml-0.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-white truncate w-full group-hover:text-[#1db954] transition-colors">{track.name}</p>
                          <p className="text-xs text-[#b3b3b3] truncate w-full mt-1">Álbum • {track.artist}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Álbumes destacados */}
                  <section className="relative">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h2 className="text-xl font-bold text-white tracking-tight">Álbumes destacados</h2>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => scrollContainer(albumsScrollRef, 'left')} 
                          className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/60 transition-colors"
                        >
                          <ArrowLeft className="h-4 w-4 text-white" />
                        </button>
                        <button 
                          onClick={() => scrollContainer(albumsScrollRef, 'right')} 
                          className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/60 transition-colors"
                        >
                          <ArrowRight className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                    <div 
                      ref={albumsScrollRef}
                      className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {ALBUMS_FOR_YOU.map((album) => (
                        <div 
                          key={album.id}
                          onClick={() => handlePlay(album)}
                          className="w-[140px] sm:w-[180px] shrink-0 bg-white/[0.02] border border-white/5 rounded-2xl p-3 hover:bg-white/[0.07] transition-all cursor-pointer group shadow-sm snap-start relative"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden mb-3 shadow-md relative">
                            <img loading="lazy" src={album.image} className="w-full h-full object-cover" alt={album.name} />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="w-12 h-12 rounded-full bg-[#1db954] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg">
                                <Play className="h-5 w-5 text-black fill-black ml-0.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-white truncate w-full group-hover:text-[#1db954] transition-colors">{album.name}</p>
                          <p className="text-xs text-[#b3b3b3] truncate w-full mt-1">Álbum • {album.artist}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Recientes */}
                  {recentlyPlayed.length > 0 && (
                    <section className="relative">
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-xl font-bold text-white tracking-tight">Recientes</h2>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => scrollContainer(recentScrollRef, 'left')} 
                            className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/60 transition-colors"
                          >
                            <ArrowLeft className="h-4 w-4 text-white" />
                          </button>
                          <button 
                            onClick={() => scrollContainer(recentScrollRef, 'right')} 
                            className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/60 transition-colors"
                          >
                            <ArrowRight className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      </div>
                      <div 
                        ref={recentScrollRef}
                        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {recentlyPlayed.map((track, i) => {
                          const songId = track.trackId || track.id
                          return (
                            <div 
                              key={songId + '-' + i}
                              onClick={() => handlePlay(track)}
                              className="w-[140px] sm:w-[180px] shrink-0 bg-white/[0.02] border border-white/5 rounded-2xl p-3 hover:bg-white/[0.07] transition-all cursor-pointer group shadow-sm snap-start relative"
                            >
                              <div className="aspect-square rounded-xl overflow-hidden mb-3 shadow-md relative">
                                <img loading="lazy" src={track.thumbnail || track.image || DEFAULT_IMG} className="w-full h-full object-cover" alt={track.title || track.name} />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="w-12 h-12 rounded-full bg-[#1db954] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg">
                                    <Play className="h-5 w-5 text-black fill-black ml-0.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm font-bold text-white truncate w-full group-hover:text-[#1db954] transition-colors">{track.title || track.name}</p>
                              <p className="text-xs text-[#b3b3b3] truncate w-full mt-1">{track.artist}</p>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )}

                  {/* Top Artists Circular Grid */}
                  {topArtists.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold text-white mb-4 tracking-tight px-1">Top Artists</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {topArtists.slice(0, 6).map((artist: any) => (
                          <div 
                            key={artist.id}
                            onClick={() => navigateTo(`artist:${artist.id}`)}
                            className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center hover:bg-white/[0.07] transition-all cursor-pointer group shadow-sm"
                          >
                            <div className="w-24 h-24 rounded-full overflow-hidden mb-3 shadow-md relative">
                              <img loading="lazy" src={artist.image || DEFAULT_IMG} className="w-full h-full object-cover" alt="" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="h-6 w-6 text-white fill-white" />
                              </div>
                            </div>
                            <span className="text-sm font-bold text-white truncate w-full group-hover:text-[#1db954] transition-colors">{artist.name}</span>
                            <span className="text-[10px] text-[#b3b3b3] mt-1">Artist</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Trending Songs Row */}
                  {trendingTracks.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold text-white mb-4 tracking-tight px-1">Trending Tracks</h2>
                      <div className="space-y-0.5 bg-white/[0.01] border border-white/5 rounded-2xl p-3">
                        {trendingTracks.slice(0, 5).map((track, i) => (
                          <TrackRow key={track.id + i} track={track} i={i} onClick={handlePlay} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Your Playlists Grid */}
                  {playlists.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold text-white mb-4 tracking-tight px-1">Featured Playlists</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {playlists.slice(0, 4).map((pl, i) => (
                          <div 
                            key={i} 
                            onClick={() => {
                              if (pl.id) navigateTo(`artists`)
                            }}
                            className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-2xl p-4 hover:bg-white/[0.08] transition-all cursor-pointer group shadow-sm"
                          >
                            <div className="aspect-square rounded-xl overflow-hidden mb-4 shadow-md relative">
                              <img loading="lazy" src={pl.image || DEFAULT_IMG} className="w-full h-full object-cover" alt="" />
                              <button className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[#1db954] flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-lg">
                                <Play className="h-4 w-4 text-black fill-black ml-0.5" />
                              </button>
                            </div>
                            <p className="text-sm font-bold text-white truncate">{pl.name}</p>
                            <p className="text-xs text-[#b3b3b3] mt-1 truncate">Playlist • {pl.trackCount || 0} tracks</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : activeTab === 'artists' ? (
                /* ─── ALL ARTISTS TAB ─── */
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Your Subscribed Artists</h2>
                  {topArtists.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {topArtists.map((artist: any) => (
                        <div 
                          key={artist.id}
                          onClick={() => navigateTo(`artist:${artist.id}`)}
                          className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col items-center text-center hover:bg-white/[0.08] transition-all cursor-pointer group shadow-md"
                        >
                          <div className="w-28 h-28 rounded-full overflow-hidden mb-4 shadow-lg relative">
                            <img loading="lazy" src={artist.image || DEFAULT_IMG} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="h-7 w-7 text-white fill-white" />
                            </div>
                          </div>
                          <span className="text-sm font-bold text-white truncate w-full group-hover:text-[#1db954] transition-colors">{artist.name}</span>
                          <span className="text-xs text-[#b3b3b3] mt-1">Verified Artist</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Mic2 className="h-12 w-12 text-[#1db954] mb-4" />
                      <p className="text-[#b3b3b3] text-sm">No artists found. Connect YouTube Music to import subscriptions.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* ─── FALLBACK EMPTY STATES (DISCOVER / ALBUMS) ─── */
                <div className="flex flex-col items-center justify-center py-40 text-center">
                  <Compass className="h-12 w-12 text-[#1db954] mb-4" />
                  <h3 className="text-lg font-bold text-white mb-1 uppercase tracking-wider text-sm">{activeTab} Section</h3>
                  <p className="text-[#b3b3b3] text-xs max-w-xs">Integrating more Spotify API content. Currently displaying custom local content on Home and Artists.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ─── RIGHT SIDEBAR (Companion Panel) ─── */}
        <div className="w-[300px] bg-black/20 border-l border-white/5 hidden xl:flex flex-col shrink-0 p-5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-white tracking-tight">Popular</span>
            <X className="h-4 w-4 text-[#b3b3b3] hover:text-white cursor-pointer" />
          </div>

          {/* Main Track Album Card */}
          {rightSidebarFeatured && (
            <div className="mb-6">
              <div className="aspect-square rounded-2xl overflow-hidden mb-3 shadow-lg bg-black/40">
                <img loading="lazy" src={currentTrack?.image || rightSidebarFeatured.image || rightSidebarFeatured.thumbnails?.[0]?.url || DEFAULT_IMG} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-base truncate">{currentTrack?.name || rightSidebarFeatured.name}</h4>
                  <p className="text-xs text-[#b3b3b3] mt-0.5 truncate">{currentTrack?.artist || rightSidebarFeatured.artist || 'Featured Artist'}</p>
                </div>
                <div className="flex items-center gap-2 relative">
                  <Heart 
                    onClick={(e) => {
                      if (companionTrack) handleToggleLike(companionTrack, e)
                    }}
                    className={cn(
                      "h-4 w-4 cursor-pointer shrink-0 transition-all hover:scale-110",
                      companionTrack && likedTrackIds.has(companionTrack.id)
                        ? "text-[#1db954] fill-[#1db954]"
                        : "text-[#b3b3b3] hover:text-white"
                    )} 
                  />
                  <MoreHorizontal 
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsCompanionMenuOpen(!isCompanionMenuOpen)
                    }}
                    className={cn(
                      "h-4 w-4 cursor-pointer shrink-0 transition-all hover:scale-110",
                      isCompanionMenuOpen ? "text-[#1db954]" : "text-[#b3b3b3] hover:text-white"
                    )}
                  />
                  {isCompanionMenuOpen && companionTrack && (
                    <div 
                      ref={companionMenuRef}
                      className="absolute right-0 top-6 w-48 bg-[#1e201b]/95 backdrop-blur-2xl border border-white/10 rounded-xl py-1 shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5">Options</div>
                      
                      {customPlaylists.length > 0 ? (
                        <div className="py-1">
                          <p className="px-3 py-1 text-[11px] font-semibold text-[#b3b3b3]">Add to Playlist:</p>
                          {customPlaylists.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                handleAddTrackToPlaylist(p.id, companionTrack)
                                setIsCompanionMenuOpen(false)
                              }}
                              className="w-full text-left px-4 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors truncate"
                            >
                              + {p.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setIsCompanionMenuOpen(false)
                            setIsCreatePlaylistOpen(true)
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-white/85 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          + Create Playlist first
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* "About the Artist" Card */}
          {rightSidebarFeatured && (
            <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5 p-4 shadow-md relative min-h-[160px] flex flex-col justify-end">
              <div className="absolute inset-0 z-0">
                <img loading="lazy" src={rightSidebarFeatured.image || rightSidebarFeatured.thumbnails?.[0]?.url || DEFAULT_IMG} className="w-full h-full object-cover opacity-35" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#151713] via-[#151713]/70 to-transparent" />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-3.5 h-3.5 text-[#3d91f4]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                  <span className="text-[10px] font-bold text-white/95 uppercase tracking-wider">Verified Artist</span>
                </div>
                <p className="text-xs text-[#b3b3b3] font-medium leading-relaxed line-clamp-3">
                  {rightSidebarFeatured.name} took over pop music & culture on their own terms, blending custom beats and premium sound aesthetics.
                </p>
              </div>
            </div>
          )}

          {/* "Next in queue" Section */}
          {nextInQueueTrack && (
            <div className="mt-auto pt-4 border-t border-white/5">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-bold text-white">Next in queue</span>
                <span className="font-semibold text-[#1db954] hover:underline cursor-pointer">Open queue</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <img loading="lazy" src={nextInQueueTrack.image || DEFAULT_IMG} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{nextInQueueTrack.name}</p>
                  <p className="text-[10px] text-[#b3b3b3] truncate">{nextInQueueTrack.artist || 'Unknown'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
      </div>

      {/* ─── CREATE PLAYLIST GLASSMORPHIC MODAL ─── */}
      {isCreatePlaylistOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#191b16]/95 border border-white/10 rounded-[28px] p-8 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setIsCreatePlaylistOpen(false)}
              className="absolute top-6 right-6 text-[#b3b3b3] hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#1db954] flex items-center justify-center shadow-lg">
                <FolderPlus className="h-5 w-5 text-black" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Create Playlist</h3>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#b3b3b3] uppercase tracking-wider mb-2">Playlist Name</label>
                <input 
                  type="text"
                  required
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. My Study Beats"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#b3b3b3]/40 focus:outline-none focus:ring-1 focus:ring-[#1db954] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#b3b3b3] uppercase tracking-wider mb-2">Description (Optional)</label>
                <textarea 
                  value={newPlaylistDesc}
                  onChange={e => setNewPlaylistDesc(e.target.value)}
                  placeholder="Add an optional description..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#b3b3b3]/40 focus:outline-none focus:ring-1 focus:ring-[#1db954] transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsCreatePlaylistOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-[#1db954] hover:bg-[#1ed760] text-black font-bold text-xs px-6 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
