'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Loader2, Wand2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export function QuickCapture() {
    const [open, setOpen] = useState(false)
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(false)
    const [categorizing, setCategorizing] = useState(false)
    const [tags, setTags] = useState<string[]>([])
    const [color, setColor] = useState('bg-background')
    const { toast } = useToast()
    const router = useRouter()

    const handleCategorize = async () => {
        if (!content.trim()) return

        setCategorizing(true)
        try {
            const response = await fetch('/api/notes/categorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            })

            if (!response.ok) throw new Error('Failed to categorize')

            const data = await response.json()
            setTags(data.tags || [])
            if (data.color) setColor(data.color)

            toast({
                title: 'Magic Categorize',
                description: 'Tags and color applied!',
            })
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to categorize note.',
                variant: 'destructive'
            })
        } finally {
            setCategorizing(false)
        }
    }

    const handleSubmit = async () => {
        if (!content.trim()) return

        setLoading(true)
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, tags, color })
            })

            if (!response.ok) throw new Error('Failed to create note')

            toast({
                title: 'Note created',
                description: 'Your note has been saved successfully.'
            })

            setContent('')
            setTags([])
            setColor('bg-background')
            setOpen(false)
            router.refresh()
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save note. Please try again.',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Quick Note
                </Button>
            </DialogTrigger>
            <DialogContent className={`sm:max-w-[425px] transition-colors duration-300 ${color}`}>
                <DialogHeader>
                    <DialogTitle>Quick Capture</DialogTitle>
                    <DialogDescription>
                        Jot down a thought, idea, or reminder.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Textarea
                        placeholder="Type your note here..."
                        className="min-h-[150px] bg-background/50"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleSubmit()
                            }
                        }}
                    />
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                    #{tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleCategorize}
                        disabled={categorizing || !content.trim()}
                        title="Magic Categorize"
                    >
                        {categorizing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                            <Wand2 className="h-4 w-4 text-primary" />
                        )}
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || !content.trim()}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Note
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
