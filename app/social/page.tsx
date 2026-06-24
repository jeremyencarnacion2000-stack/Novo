'use client'

import { useState, useEffect } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, UserPlus, MessageSquare, Check, X, ArrowLeft } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'

export default function SocialPage() {
    const { data: session } = useSession()
    const { toast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [friends, setFriends] = useState<any[]>([])
    const [requests, setRequests] = useState<any[]>([])
    const [selectedFriend, setSelectedFriend] = useState<any>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState('')

    // Send Message
    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedFriend) return
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiverId: selectedFriend.id, content: newMessage })
            })
            if (res.ok) {
                setNewMessage('')
                fetchMessages(selectedFriend.id)
            }
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    // Fetch Friends & Requests
    const fetchFriends = async () => {
        try {
            const res = await fetch('/api/friends')
            if (res.ok) {
                const data = await res.json()
                const confirmed = data.filter((f: any) => f.status === 'ACCEPTED')
                const pending = data.filter((f: any) => f.status === 'PENDING' && f.addresseeId === session?.user?.id)

                // Map to friend user object
                const mappedFriends = confirmed.map((f: any) =>
                    f.requesterId === session?.user?.id ? f.addressee : f.requester
                )

                setFriends(mappedFriends)
                setRequests(pending)
            }
        } catch (error) {
            console.error('Error fetching friends:', error)
        }
    }

    useEffect(() => {
        if (session) fetchFriends()
    }, [session])

    // Search Users
    const handleSearch = async () => {
        if (searchQuery.length < 2) return
        try {
            const res = await fetch(`/api/users/search?q=${searchQuery}`)
            if (res.ok) {
                setSearchResults(await res.json())
            }
        } catch (error) {
            console.error('Error searching:', error)
        }
    }

    // Send Friend Request
    const sendRequest = async (userId: string) => {
        try {
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: userId, action: 'request' })
            })
            if (res.ok) {
                toast({ title: 'Friend request sent!' })
                setSearchResults(prev => prev.filter(u => u.id !== userId))
            } else {
                toast({ title: 'Failed to send request', variant: 'destructive' })
            }
        } catch (error) {
            console.error('Error sending request:', error)
        }
    }

    // Accept/Reject Request
    const handleRequest = async (userId: string, action: 'accept' | 'reject') => {
        try {
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: userId, action })
            })
            if (res.ok) {
                toast({ title: `Request ${action}ed` })
                fetchFriends()
            }
        } catch (error) {
            console.error('Error handling request:', error)
        }
    }

    // Fetch Messages
    const fetchMessages = async (friendId: string) => {
        try {
            const res = await fetch(`/api/messages?userId=${friendId}`)
            if (res.ok) {
                setMessages(await res.json())
            }
        } catch (error) {
            console.error('Error fetching messages:', error)
        }
    }

    useEffect(() => {
        if (selectedFriend) {
            fetchMessages(selectedFriend.id)
            const interval = setInterval(() => fetchMessages(selectedFriend.id), 5000) // Poll every 5s
            return () => clearInterval(interval)
        }
    }, [selectedFriend])

    return (
        <div className="flex-1 space-y-4 p-3 md:p-8 pt-6 h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Social Hub</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 flex-1 overflow-hidden">
                {/* Left Sidebar: Friends & Search */}
                <div className={`md:col-span-4 flex flex-col gap-4 overflow-hidden ${selectedFriend ? 'hidden md:flex' : 'flex'}`}>
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        <CardHeader className="pb-2">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search users..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button size="icon" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden p-0">
                            <Tabs defaultValue="friends" className="h-full flex flex-col">
                                <TabsList className="w-full justify-start rounded-none border-b px-4">
                                    <TabsTrigger value="friends">Friends</TabsTrigger>
                                    <TabsTrigger value="requests">
                                        Requests
                                        {requests.length > 0 && (
                                            <span className="ml-2 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-xs">
                                                {requests.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    <TabsTrigger value="search">Search</TabsTrigger>
                                </TabsList>

                                <TabsContent value="friends" className="flex-1 overflow-hidden">
                                    <ScrollArea className="h-full">
                                        <div className="p-4 space-y-2">
                                            {friends.map(friend => (
                                                <div
                                                    key={friend.id}
                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted ${selectedFriend?.id === friend.id ? 'bg-muted' : ''}`}
                                                    onClick={() => setSelectedFriend(friend)}
                                                >
                                                    <Avatar>
                                                        <AvatarImage src={friend.image} />
                                                        <AvatarFallback>{friend.name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="font-medium truncate">{friend.name}</p>
                                                    </div>
                                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            ))}
                                            {friends.length === 0 && (
                                                <p className="text-center text-muted-foreground py-4">No friends yet.</p>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="requests" className="flex-1 overflow-hidden">
                                    <ScrollArea className="h-full">
                                        <div className="p-4 space-y-2">
                                            {requests.map((req: any) => (
                                                <div key={req.id} className="flex items-center gap-3 p-2 border rounded-lg">
                                                    <Avatar>
                                                        <AvatarImage src={req.requester.image} />
                                                        <AvatarFallback>{req.requester.name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{req.requester.name}</p>
                                                        <p className="text-xs text-muted-foreground">Sent a request</p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={() => handleRequest(req.requester.id, 'accept')}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleRequest(req.requester.id, 'reject')}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {requests.length === 0 && (
                                                <p className="text-center text-muted-foreground py-4">No pending requests.</p>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="search" className="flex-1 overflow-hidden">
                                    <ScrollArea className="h-full">
                                        <div className="p-4 space-y-2">
                                            {searchResults.map(user => (
                                                <div key={user.id} className="flex items-center gap-3 p-2 border rounded-lg">
                                                    <Avatar>
                                                        <AvatarImage src={user.image} />
                                                        <AvatarFallback>{user.name?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="font-medium truncate">{user.name}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{user.bio || 'No bio'}</p>
                                                    </div>
                                                    <Button size="sm" variant="secondary" onClick={() => sendRequest(user.id)}>
                                                        <UserPlus className="h-4 w-4 mr-2" />
                                                        Add
                                                    </Button>
                                                </div>
                                            ))}
                                            {searchResults.length === 0 && searchQuery.length > 1 && (
                                                <p className="text-center text-muted-foreground py-4">No users found.</p>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Area: Chat */}
                <div className={`md:col-span-8 flex flex-col overflow-hidden ${selectedFriend ? 'flex' : 'hidden md:flex'}`}>
                    <Card className="flex-1 flex flex-col overflow-hidden">
                        {selectedFriend ? (
                            <>
                                <CardHeader className="border-b py-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setSelectedFriend(null)}
                                            className="md:hidden p-1 rounded-lg hover:bg-accent transition-colors"
                                        >
                                            <ArrowLeft className="h-5 w-5" />
                                        </button>
                                        <Avatar>
                                            <AvatarImage src={selectedFriend.image} />
                                            <AvatarFallback>{selectedFriend.name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <CardTitle className="text-base">{selectedFriend.name}</CardTitle>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                                    <ScrollArea className="flex-1 p-4">
                                        <div className="space-y-4">
                                            {messages.map((msg) => {
                                                const isMe = msg.senderId === session?.user?.id
                                                return (
                                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[70%] rounded-lg px-4 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                            <p>{msg.content}</p>
                                                            <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </ScrollArea>
                                    <div className="p-4 border-t flex gap-2">
                                        <Input
                                            placeholder="Type a message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                        />
                                        <Button onClick={sendMessage}>Send</Button>
                                    </div>
                                </CardContent>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                Select a friend to start chatting
                            </div>
                        )}

                    </Card>
                </div>
            </div>
        </div>
    )
}
