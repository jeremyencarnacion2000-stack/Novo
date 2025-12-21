"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Users, Mail, Loader2 } from "lucide-react"

interface Contact {
    name: string
    email: string
    photo: string
}

export function GoogleContacts() {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchContacts = async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/contacts')
                if (res.ok) {
                    const data = await res.json()
                    if (Array.isArray(data)) {
                        setContacts(data)
                    } else {
                        setContacts([])
                    }
                }
            } catch (error) {
                console.error('Failed to fetch contacts:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchContacts()
    }, [])

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        Google Contacts
                    </CardTitle>
                    <CardDescription>Your contacts from Google</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    Google Contacts ({contacts.length})
                </CardTitle>
                <CardDescription>Your contacts synced from Google</CardDescription>
            </CardHeader>
            <CardContent>
                {contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <Users className="h-12 w-12 mb-2 opacity-50" />
                        <p>No contacts found</p>
                        <p className="text-xs mt-1">Make sure you've granted contacts permission</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                            {contacts.map((contact, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={contact.photo} alt={contact.name || 'Contact'} />
                                        <AvatarFallback>
                                            {contact.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {contact.name || 'Unknown'}
                                        </p>
                                        {contact.email && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Mail className="h-3 w-3" />
                                                <span className="truncate">{contact.email}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    )
}
