'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Search, UserPlus, Check, X, ArrowLeft, Send, Users, MessageCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClientIdempotencyKey } from '@/lib/client-idempotency'

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
  // Keep a request in one client-side flight. The API is replay-safe too, but
  // the UI should immediately communicate that a friend invitation is being
  // processed instead of allowing a double-click to create competing calls.
  const [pendingRequestIds, setPendingRequestIds] = useState<Set<string>>(new Set())
  const pendingRequestIdsRef = useRef(new Set<string>())
  const [pendingFriendActions, setPendingFriendActions] = useState<Set<string>>(new Set())
  const pendingFriendActionsRef = useRef(new Set<string>())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRequestRef = useRef<AbortController | null>(null)
  const messageIntentRef = useRef<{ fingerprint: string; key: string } | null>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchFriends = useCallback(async (signal?: AbortSignal) => {
    const userId = session?.user?.id
    if (!userId) {
      setFriends([])
      setRequests([])
      return
    }
    try {
      const res = await fetch('/api/friends', { cache: 'no-store', signal })
      if (!res.ok) return
      const data = await res.json()
      if (signal?.aborted) return
      const confirmed = data.filter((f: any) => f.status === 'ACCEPTED')
      const pending   = data.filter((f: any) => f.status === 'PENDING' && f.addresseeId === userId)
      setFriends(confirmed.map((f: any) =>
        f.requesterId === userId ? f.addressee : f.requester
      ))
      setRequests(pending)
    } catch (error: unknown) {
      if ((error as { name?: string })?.name !== 'AbortError' && !signal?.aborted) {
        // A background refresh should keep the last known social state.
      }
    }
  }, [session?.user?.id])

  useEffect(() => {
    const controller = new AbortController()
    void fetchFriends(controller.signal)
    return () => controller.abort()
  }, [fetchFriends])

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, { signal: controller.signal, cache: 'no-store' })
        if (res.ok && !controller.signal.aborted) setSearchResults(await res.json())
      } catch (error: unknown) {
        if ((error as { name?: string })?.name !== 'AbortError') return
      }
    }, 400)
    return () => { clearTimeout(t); controller.abort() }
  }, [searchQuery])

  const sendRequest = async (userId: string) => {
    if (pendingRequestIdsRef.current.has(userId)) return
    pendingRequestIdsRef.current.add(userId)
    setPendingRequestIds(prev => new Set(prev).add(userId))
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, action: 'request' }),
      })
      if (res.ok) setSearchResults(prev => prev.filter(u => u.id !== userId))
    } catch {}
    finally {
      pendingRequestIdsRef.current.delete(userId)
      setPendingRequestIds(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  const handleRequest = async (userId: string, action: 'accept' | 'reject') => {
    const actionKey = `${action}:${userId}`
    if (pendingFriendActionsRef.current.has(actionKey)) return
    pendingFriendActionsRef.current.add(actionKey)
    setPendingFriendActions(prev => new Set(prev).add(actionKey))
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, action }),
      })
      if (res.ok) fetchFriends()
    } catch {}
    finally {
      pendingFriendActionsRef.current.delete(actionKey)
      setPendingFriendActions(prev => {
        const next = new Set(prev)
        next.delete(actionKey)
        return next
      })
    }
  }

  const fetchMessages = async (friendId: string) => {
    messagesRequestRef.current?.abort()
    const controller = new AbortController()
    messagesRequestRef.current = controller
    try {
      const res = await fetch(`/api/messages?userId=${friendId}`, { signal: controller.signal })
      if (res.ok && !controller.signal.aborted) setMessages(await res.json())
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') return
    } finally {
      if (messagesRequestRef.current === controller) messagesRequestRef.current = null
    }
  }

  useEffect(() => {
    if (!selectedFriend) return
    let active = true
    const refresh = () => {
      if (active && document.visibilityState === 'visible') void fetchMessages(selectedFriend.id)
    }
    refresh()
    let interval: ReturnType<typeof setInterval> | null = setInterval(refresh, 30000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh()
        if (interval === null) interval = setInterval(refresh, 30000)
      } else if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      active = false
      if (interval !== null) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      messagesRequestRef.current?.abort()
      messagesRequestRef.current = null
    }
  }, [selectedFriend])

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedFriend || sending) return
    const content = newMessage.trim()
    const fingerprint = `${selectedFriend.id}:${content}`
    const previous = messageIntentRef.current
    const intent = previous?.fingerprint === fingerprint
      ? previous
      : { fingerprint, key: createClientIdempotencyKey() }
    messageIntentRef.current = intent
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': intent.key,
        },
        body: JSON.stringify({ receiverId: selectedFriend.id, content }),
      })
      if (res.ok) {
        messageIntentRef.current = null
        setNewMessage('')
        void fetchMessages(selectedFriend.id)
      }
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
      <div className="w-full h-full bg-card/90 backdrop-blur-2xl border-0 sm:border sm:border-border/70 rounded-none sm:rounded-[28px] flex overflow-hidden shadow-2xl">

        {/* ─── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <div className={cn(
          'flex-col w-full sm:w-[300px] bg-muted/45 border-r border-border/60 shrink-0',
          selectedFriend ? 'hidden sm:flex' : 'flex',
        )}>
          {/* Header */}
          <div className="px-5 pt-6 pb-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="text-sm font-bold text-foreground tracking-tight">Social</h2>
              </div>
              {friends.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium">{friends.length} friends</span>
              )}
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  if (e.target.value.length >= 2) setActiveTab('search')
                }}
                onFocus={() => setActiveTab('search')}
                placeholder="Find people…"
                className="w-full bg-muted/60 border border-border rounded-2xl pl-9 pr-9 h-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-muted transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                    ? 'bg-muted text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
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
                      : 'bg-muted text-muted-foreground',
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
                      icon={<Users className="h-5 w-5 text-muted-foreground" />}
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
                          ? 'bg-muted border border-border'
                          : 'hover:bg-muted/60',
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
                        <p className="text-sm font-semibold text-foreground truncate">{friend.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">Online</p>
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
                      icon={<Check className="h-5 w-5 text-muted-foreground" />}
                      text="No pending requests."
                    />
                  ) : requests.map((req: any) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-muted/60 border border-border/70"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={req.requester.image} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {req.requester.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{req.requester.name}</p>
                        <p className="text-[10px] text-muted-foreground">Friend request</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void handleRequest(req.requester.id, 'accept')}
                          disabled={pendingFriendActions.has(`accept:${req.requester.id}`) || pendingFriendActions.has(`reject:${req.requester.id}`)}
                          aria-busy={pendingFriendActions.has(`accept:${req.requester.id}`)}
                          className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/25 transition-colors disabled:cursor-wait disabled:opacity-50"
                          title="Accept"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        </button>
                        <button
                          onClick={() => void handleRequest(req.requester.id, 'reject')}
                          disabled={pendingFriendActions.has(`accept:${req.requester.id}`) || pendingFriendActions.has(`reject:${req.requester.id}`)}
                          aria-busy={pendingFriendActions.has(`reject:${req.requester.id}`)}
                          className="w-7 h-7 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center hover:bg-red-500/20 transition-colors disabled:cursor-wait disabled:opacity-50"
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
                      icon={<Search className="h-5 w-5 text-muted-foreground" />}
                      text="Type at least 2 characters to search."
                    />
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-10">
                      No results for &quot;{searchQuery}&quot;
                    </p>
                  ) : searchResults.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-muted/60 border border-border/70"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={user.image} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {user.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.bio || 'Novo user'}</p>
                      </div>
                      <button
                        onClick={() => void sendRequest(user.id)}
                        disabled={pendingRequestIds.has(user.id)}
                        aria-busy={pendingRequestIds.has(user.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary/15 border border-primary/20 text-primary text-[11px] font-bold hover:bg-primary/25 transition-colors shrink-0 disabled:cursor-wait disabled:opacity-60"
                      >
                        <UserPlus className="h-3 w-3" />
                        {pendingRequestIds.has(user.id) ? 'Adding…' : 'Add'}
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
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 shrink-0">
                  <button
                    onClick={() => setSelectedFriend(null)}
                    className="sm:hidden w-8 h-8 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
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
                    <p className="text-sm font-bold text-foreground leading-tight">{selectedFriend.name}</p>
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
                          className="w-14 h-14 rounded-2xl bg-muted/60 border border-border/70 flex items-center justify-center"
                        >
                          <MessageCircle className="h-6 w-6 text-muted-foreground" />
                        </motion.div>
                        <p className="text-sm text-muted-foreground font-medium">
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
                                <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                                  {selectedFriend.name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={cn(
                              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                              isMe
                                ? 'bg-primary/75 text-primary-foreground rounded-br-sm shadow-[0_2px_12px_rgba(var(--primary-rgb),0.25)]'
                                : 'bg-muted/70 border border-border text-foreground rounded-bl-sm',
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
                <div className="px-4 sm:px-6 py-4 border-t border-border/60 shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder={`Message ${selectedFriend.name}…`}
                      className="flex-1 bg-muted/60 border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-muted transition-colors"
                    />
                    <motion.button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shrink-0 transition-opacity"
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
                  className="w-16 h-16 rounded-3xl bg-muted/60 border border-border/70 flex items-center justify-center"
                >
                  <MessageCircle className="h-7 w-7 text-muted-foreground" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Select a conversation</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
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
      <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border/70 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">{text}</p>
    </div>
  )
}
