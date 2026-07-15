'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  Search, UserPlus, Check, X, ArrowLeft, Send, Users, MessageCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type ActiveTab = 'friends' | 'requests' | 'search'

export default function SocialPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab]         = useState<ActiveTab>('friends')
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [friends, setFriends]             = useState<any[]>([])
  const [requests, setRequests]           = useState<any[]>([])
  const [selectedFriend, setSelectedFriend] = useState<any>(null)
  const [messages, setMessages]           = useState<any[]>([])
  const [newMessage, setNewMessage]       = useState('')
  const [sending, setSending]             = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends')
      if (!res.ok) return
      const data = await res.json()
      const confirmed = data.filter((f: any) => f.status === 'ACCEPTED')
      const pending   = data.filter((f: any) => f.status === 'PENDING' && f.addresseeId === session?.user?.id)
      setFriends(confirmed.map((f: any) =>
        f.requesterId === session?.user?.id ? f.addressee : f.requester
      ))
      setRequests(pending)
    } catch {}
  }

  useEffect(() => { if (session) fetchFriends() }, [session])

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) setSearchResults(await res.json())
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  const sendRequest = async (userId: string) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, action: 'request' }),
      })
      if (res.ok) setSearchResults(prev => prev.filter(u => u.id !== userId))
    } catch {}
  }

  const handleRequest = async (userId: string, action: 'accept' | 'reject') => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, action }),
      })
      if (res.ok) fetchFriends()
    } catch {}
  }

  const fetchMessages = async (friendId: string) => {
    try {
      const res = await fetch(`/api/messages?userId=${friendId}`)
      if (res.ok) setMessages(await res.json())
    } catch {}
  }

  useEffect(() => {
    if (!selectedFriend) return
    fetchMessages(selectedFriend.id)
    const interval = setInterval(() => fetchMessages(selectedFriend.id), 30000)
    return () => clearInterval(interval)
  }, [selectedFriend])

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedFriend || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: selectedFriend.id, content: newMessage }),
      })
      if (res.ok) { setNewMessage(''); fetchMessages(selectedFriend.id) }
    } catch {}
    setSending(false)
  }

  // ── Tab definitions ────────────────────────────────────────────────────────
  const TABS: { id: ActiveTab; label: string; count?: number }[] = [
    { id: 'friends',  label: 'Friends',  count: friends.length  },
    { id: 'requests', label: 'Requests', count: requests.length },
    { id: 'search',   label: 'Discover'                         },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 p-0 sm:p-3 lg:p-5 flex flex-col">
      <div className="w-full h-full bg-[#09090e]/90 backdrop-blur-2xl border-0 sm:border sm:border-white/[0.07] rounded-none sm:rounded-[28px] flex overflow-hidden shadow-2xl">

        {/* ─── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <div className={cn(
          'flex-col w-full sm:w-[300px] bg-black/25 border-r border-white/[0.05] shrink-0',
          selectedFriend ? 'hidden sm:flex' : 'flex',
        )}>
          {/* Header */}
          <div className="px-5 pt-6 pb-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="text-sm font-bold text-white tracking-tight">Social</h2>
              </div>
              {friends.length > 0 && (
                <span className="text-[10px] text-white/25 font-medium">{friends.length} friends</span>
              )}
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  if (e.target.value.length >= 2) setActiveTab('search')
                }}
                onFocus={() => setActiveTab('search')}
                placeholder="Find people…"
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl pl-9 pr-9 h-9 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-white/[0.05] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pb-3 shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-all',
                  activeTab === tab.id
                    ? 'bg-white/[0.07] text-white border border-white/[0.08]'
                    : 'text-white/25 hover:text-white/50 hover:bg-white/[0.03]',
                )}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    'text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none',
                    activeTab === tab.id
                      ? tab.id === 'requests'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-primary/20 text-primary'
                      : 'bg-white/10 text-white/40',
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {/* pb-40 on mobile: clears GeminiLiveOrb's fixed bottom-right
              button (bottom:5rem + 56px ≈ 136px) — same fix as the other
              full-screen pages (music/cognitive/ai). */}
          <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-40 md:pb-3 custom-scrollbar" data-lenis-prevent>
            <AnimatePresence mode="wait">

              {/* ── Friends list ── */}
              {activeTab === 'friends' && (
                <motion.div
                  key="friends"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col gap-1"
                >
                  {friends.length === 0 ? (
                    <EmptyState
                      icon={<Users className="h-5 w-5 text-white/20" />}
                      text="No friends yet. Use Discover to find people."
                    />
                  ) : friends.map(friend => (
                    <motion.button
                      key={friend.id}
                      onClick={() => setSelectedFriend(friend)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left w-full',
                        selectedFriend?.id === friend.id
                          ? 'bg-white/[0.07] border border-white/[0.08]'
                          : 'hover:bg-white/[0.04]',
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={friend.image} />
                          <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                            {friend.name?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#09090e]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{friend.name}</p>
                        <p className="text-[11px] text-white/30 truncate">Online</p>
                      </div>
                      {selectedFriend?.id === friend.id && (
                        <MessageCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {/* ── Requests ── */}
              {activeTab === 'requests' && (
                <motion.div
                  key="requests"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col gap-2"
                >
                  {requests.length === 0 ? (
                    <EmptyState
                      icon={<Check className="h-5 w-5 text-white/20" />}
                      text="No pending requests."
                    />
                  ) : requests.map((req: any) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={req.requester.image} />
                        <AvatarFallback className="bg-white/10 text-white/60 text-xs">
                          {req.requester.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{req.requester.name}</p>
                        <p className="text-[10px] text-white/30">Friend request</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRequest(req.requester.id, 'accept')}
                          className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/25 transition-colors"
                          title="Accept"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        </button>
                        <button
                          onClick={() => handleRequest(req.requester.id, 'reject')}
                          className="w-7 h-7 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                          title="Decline"
                        >
                          <X className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* ── Search / Discover ── */}
              {activeTab === 'search' && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col gap-2"
                >
                  {searchQuery.length < 2 ? (
                    <EmptyState
                      icon={<Search className="h-5 w-5 text-white/20" />}
                      text="Type at least 2 characters to search."
                    />
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-white/25 text-center py-10">
                      No results for &quot;{searchQuery}&quot;
                    </p>
                  ) : searchResults.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={user.image} />
                        <AvatarFallback className="bg-white/10 text-white/60 text-xs">
                          {user.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-white/30 truncate">{user.bio || 'Novo user'}</p>
                      </div>
                      <button
                        onClick={() => sendRequest(user.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/15 border border-primary/20 text-primary text-[11px] font-bold hover:bg-primary/25 transition-colors shrink-0"
                      >
                        <UserPlus className="h-3 w-3" />
                        Add
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* ─── CHAT AREA ─────────────────────────────────────────────────────── */}
        <div className={cn(
          'flex-1 flex-col min-w-0',
          selectedFriend ? 'flex' : 'hidden sm:flex',
        )}>
          <AnimatePresence mode="wait">
            {selectedFriend ? (
              <motion.div
                key={selectedFriend.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
              >
                {/* Chat header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05] shrink-0">
                  <button
                    onClick={() => setSelectedFriend(null)}
                    className="sm:hidden w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4 text-white/50" />
                  </button>
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={selectedFriend.image} />
                      <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                        {selectedFriend.name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#09090e]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">{selectedFriend.name}</p>
                    <p className="text-[10px] text-emerald-400 font-semibold">Online</p>
                  </div>
                </div>

                {/* Messages */}
                <div
                  className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-3 custom-scrollbar"
                  data-lenis-prevent
                >
                  <AnimatePresence initial={false}>
                    {messages.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center h-full gap-3 text-center"
                      >
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"
                        >
                          <MessageCircle className="h-6 w-6 text-white/15" />
                        </motion.div>
                        <p className="text-sm text-white/25 font-medium">
                          Start a conversation with {selectedFriend.name}
                        </p>
                      </motion.div>
                    ) : (
                      messages.map((msg, i) => {
                        const isMe = msg.senderId === session?.user?.id
                        return (
                          <motion.div
                            key={msg.id || i}
                            initial={{ opacity: 0, y: 10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            className={cn(
                              'flex gap-2 items-end max-w-[78%]',
                              isMe ? 'ml-auto flex-row-reverse' : '',
                            )}
                          >
                            {!isMe && (
                              <Avatar className="h-6 w-6 shrink-0 mb-0.5">
                                <AvatarImage src={selectedFriend.image} />
                                <AvatarFallback className="text-[9px] bg-white/10 text-white/50">
                                  {selectedFriend.name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={cn(
                              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                              isMe
                                ? 'bg-primary/75 text-white rounded-br-sm shadow-[0_2px_12px_rgba(var(--primary-rgb),0.25)]'
                                : 'bg-white/[0.05] border border-white/[0.07] text-white/90 rounded-bl-sm',
                            )}>
                              <p>{msg.content}</p>
                              {msg.createdAt && (
                                <p className={cn(
                                  'text-[9px] mt-1 opacity-40 select-none',
                                  isMe ? 'text-right' : '',
                                )}>
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                <div className="px-4 sm:px-6 py-4 border-t border-white/[0.05] shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder={`Message ${selectedFriend.name}…`}
                      className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-white/[0.06] transition-all"
                    />
                    <motion.button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shrink-0 transition-opacity"
                    >
                      <Send className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Empty chat state */
              <motion.div
                key="empty-chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"
                >
                  <MessageCircle className="h-7 w-7 text-white/15" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-white/35">Select a conversation</p>
                  <p className="text-xs text-white/20 mt-1 max-w-[200px]">
                    Choose a friend from the list to start chatting
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  )
}

// ── Shared empty state ─────────────────────────────────────────────────────────
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
        {icon}
      </div>
      <p className="text-xs text-white/25 max-w-[180px] leading-relaxed">{text}</p>
    </div>
  )
}
