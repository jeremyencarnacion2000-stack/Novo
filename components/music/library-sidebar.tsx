'use client'

import React, { useState } from 'react'
import {
    Search,
    Plus,
    Library,
    Heart,
    ChevronLeft,
    ChevronRight,
    ListMusic,
    LayoutGrid,
    List,
    Play
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { SpotifyPlaylist } from '@/lib/spotify'

interface LibrarySidebarProps {
    playlists: SpotifyPlaylist[] | null
    savedTracksCount: number
    isCollapsed: boolean
    onToggleCollapse: () => void
    onPlaylistClick: (playlist: SpotifyPlaylist) => void
    onLikedSongsClick: () => void
    selectedPlaylistId?: string | null
}

type FilterTab = 'playlists' | 'artists' | 'albums'

export function LibrarySidebar({
    playlists,
    savedTracksCount,
    isCollapsed,
    onToggleCollapse,
    onPlaylistClick,
    onLikedSongsClick,
    selectedPlaylistId
}: LibrarySidebarProps) {
    const [activeFilter, setActiveFilter] = useState<FilterTab>('playlists')
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)

    const filteredPlaylists = playlists?.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []

    if (isCollapsed) {
        return (
            <div className="w-[72px] bg-[#121212] flex flex-col h-full border-r border-[#282828]">
                {/* Collapsed header */}
                <div className="p-3 flex flex-col items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleCollapse}
                        className="text-gray-400 hover:text-white w-10 h-10"
                    >
                        <Library className="h-6 w-6" />
                    </Button>
                </div>

                <ScrollArea className="flex-1">
                    <div className="flex flex-col items-center gap-2 px-2 py-2">
                        {/* Liked Songs */}
                        <button
                            onClick={onLikedSongsClick}
                            className="w-12 h-12 rounded bg-gradient-to-br from-indigo-700 to-blue-300 flex items-center justify-center hover:scale-105 transition-transform"
                            title="Liked Songs"
                        >
                            <Heart className="h-5 w-5 text-white fill-white" />
                        </button>

                        {/* Playlists */}
                        {playlists?.slice(0, 8).map((playlist) => (
                            <button
                                key={playlist.id}
                                onClick={() => onPlaylistClick(playlist)}
                                className={cn(
                                    "w-12 h-12 rounded overflow-hidden hover:scale-105 transition-transform",
                                    selectedPlaylistId === playlist.id && "ring-2 ring-white"
                                )}
                                title={playlist.name}
                            >
                                <img
                                    src={playlist.images?.[0]?.url || '/placeholder-album.png'}
                                    alt={playlist.name}
                                    className="w-full h-full object-cover"
                                />
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        )
    }

    return (
        <div className="w-[280px] bg-[#121212] flex flex-col h-full border-r border-[#282828]">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <button
                    onClick={onToggleCollapse}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <Library className="h-6 w-6" />
                    <span className="font-bold">Your Library</span>
                </button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleCollapse}
                    className="text-gray-400 hover:text-white hover:bg-[#1a1a1a] h-8 w-8"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
                {showSearch ? (
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search in Your Library"
                            className="pl-8 h-8 bg-[#242424] border-0 text-white placeholder:text-gray-400 text-sm"
                            autoFocus
                            onBlur={() => !searchQuery && setShowSearch(false)}
                        />
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSearch(true)}
                        className="text-gray-400 hover:text-white h-8 w-8"
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Library Items */}
            <ScrollArea className="flex-1">
                <div className="px-2 py-1">
                    {/* Liked Songs */}
                    <button
                        onClick={onLikedSongsClick}
                        className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-md hover:bg-[#1a1a1a] transition-colors group",
                            selectedPlaylistId === 'liked-songs' && "bg-[#1a1a1a]"
                        )}
                    >
                        <div className="w-12 h-12 rounded bg-gradient-to-br from-indigo-700 to-blue-300 flex items-center justify-center flex-shrink-0">
                            <Heart className="h-5 w-5 text-white fill-white" />
                        </div>
                        <div className="flex flex-col items-start min-w-0 flex-1">
                            <span className="text-white font-medium truncate w-full text-left">Liked Songs</span>
                            <span className="text-gray-400 text-sm truncate w-full text-left">Playlist • {savedTracksCount} songs</span>
                        </div>
                    </button>

                    {/* Playlists */}
                    {filteredPlaylists.map((playlist) => (
                        <button
                            key={playlist.id}
                            onClick={() => onPlaylistClick(playlist)}
                            className={cn(
                                "w-full flex items-center gap-3 p-2 rounded-md hover:bg-[#1a1a1a] transition-colors group",
                                selectedPlaylistId === playlist.id && "bg-[#1a1a1a]"
                            )}
                        >
                            <img
                                src={playlist.images?.[0]?.url || '/placeholder-album.png'}
                                alt={playlist.name}
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                            />
                            <div className="flex flex-col items-start min-w-0 flex-1">
                                <span className="text-white font-medium truncate w-full text-left">{playlist.name}</span>
                                <span className="text-gray-400 text-sm truncate w-full text-left">
                                    Playlist • {playlist.owner?.display_name || 'User'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}
