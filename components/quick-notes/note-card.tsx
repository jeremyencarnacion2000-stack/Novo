'use client'

import { useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pin, Archive, Trash2, Palette, Copy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface NoteCardProps {
    note: {
        id: string
        content: string
        isPinned: boolean
        isArchived: boolean
        color: string | null
        tags: string[]
        updatedAt: string
    }
    onChange?: () => void
}

const COLORS = [
    { name: 'Default', value: null },
    { name: 'Red', value: 'bg-red-50 dark:bg-red-950/30' },
    { name: 'Green', value: 'bg-green-50 dark:bg-green-950/30' },
    { name: 'Blue', value: 'bg-blue-50 dark:bg-blue-950/30' },
    { name: 'Yellow', value: 'bg-yellow-50 dark:bg-yellow-950/30' },
    { name: 'Purple', value: 'bg-purple-50 dark:bg-purple-950/30' },
]

export function NoteCard({ note, onChange }: NoteCardProps) {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)

    const updateNote = async (updates: any) => {
        setLoading(true)
        try {
            const response = await fetch(`/api/notes/${note.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            })

            if (!response.ok) throw new Error('Failed to update note')
            onChange?.()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update note',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const deleteNote = async () => {
        if (!confirm('Are you sure you want to delete this note?')) return

        setLoading(true)
        try {
            const response = await fetch(`/api/notes/${note.id}`, {
                method: 'DELETE'
            })

            if (!response.ok) throw new Error('Failed to delete note')

            toast({
                title: 'Note deleted',
                description: 'Note has been permanently removed'
            })
            onChange?.()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete note',
                variant: 'destructive'
            })
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(note.content)
        toast({
            title: 'Copied',
            description: 'Note content copied to clipboard'
        })
    }

    return (
        <Card className={cn("transition-all hover:shadow-md", note.color)}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex gap-2">
                    {note.isPinned && <Pin className="h-4 w-4 text-primary fill-primary" />}
                    {note.isArchived && <Archive className="h-4 w-4 text-muted-foreground" />}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateNote({ isPinned: !note.isPinned })}>
                            <Pin className="mr-2 h-4 w-4" />
                            {note.isPinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateNote({ isArchived: !note.isArchived })}>
                            <Archive className="mr-2 h-4 w-4" />
                            {note.isArchived ? 'Unarchive' : 'Archive'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyToClipboard}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy text
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={deleteNote} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent>
                <p className="whitespace-pre-wrap text-sm">{note.content}</p>
            </CardContent>
            <CardFooter className="flex justify-between">
                <div className="text-xs text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex gap-1">
                    {COLORS.map((c) => (
                        <button
                            key={c.name}
                            className={cn(
                                "h-4 w-4 rounded-full border border-primary/10 transition-transform hover:scale-110",
                                c.value || "bg-background",
                                note.color === c.value && "ring-2 ring-primary ring-offset-1"
                            )}
                            onClick={() => updateNote({ color: c.value })}
                            title={c.name}
                        />
                    ))}
                </div>
            </CardFooter>
        </Card>
    )
}
