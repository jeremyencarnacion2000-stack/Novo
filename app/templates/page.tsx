'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { defaultTemplates } from '@/lib/templates'
import { Copy, Loader2, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

export default function TemplatesPage() {
    const [usingId, setUsingId] = useState<string | null>(null)
    const { toast } = useToast()
    const router = useRouter()

    const handleUseTemplate = async (template: any) => {
        setUsingId(template.id)
        try {
            const response = await fetch('/api/templates/use', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: template.id })
            })

            if (response.ok) {
                const data = await response.json()
                toast({
                    title: 'Template used!',
                    description: `${template.name} has been added to your ${template.type}s.`,
                })

                // Optional: Redirect to the created item
                if (data.type === 'routine') router.push('/routines')
                if (data.type === 'project') router.push('/projects')
                if (data.type === 'tracker') router.push('/trackers')
            } else {
                throw new Error('Failed to use template')
            }
        } catch (error) {
            console.error('Error using template:', error)
            toast({
                title: 'Error',
                description: 'Failed to use template.',
                variant: 'destructive',
            })
        } finally {
            setUsingId(null)
        }
    }

    const categories = ['All', ...Array.from(new Set(defaultTemplates.map(t => t.category)))]

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Templates</h2>
                <p className="text-muted-foreground">
                    Jumpstart your productivity with pre-built workflows.
                </p>
            </div>

            <Tabs defaultValue="All" className="space-y-4">
                <TabsList>
                    {categories.map(category => (
                        <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
                    ))}
                </TabsList>

                {categories.map(category => (
                    <TabsContent key={category} value={category} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {defaultTemplates
                                .filter(t => category === 'All' || t.category === category)
                                .map(template => (
                                    <Card key={template.id} className="flex flex-col">
                                        <CardHeader>
                                            <div className="flex justify-between items-start">
                                                <Badge variant="outline" className="mb-2">{template.type}</Badge>
                                                <Badge variant="secondary">{template.category}</Badge>
                                            </div>
                                            <CardTitle>{template.name}</CardTitle>
                                            <CardDescription>{template.description}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1">
                                            <div className="text-sm text-muted-foreground">
                                                {template.type === 'routine' && (
                                                    <p>{template.content?.tasks?.length || 0} steps • {template.content?.tasks?.reduce((acc: number, t: any) => acc + (t.duration || 0), 0) || 0} mins</p>
                                                )}
                                                {template.type === 'project' && (
                                                    <p>{template.content?.tasks?.length || 0} initial tasks</p>
                                                )}
                                                {template.type === 'tracker' && (
                                                    <p>Goal: {template.content?.goal} {template.content?.unit}</p>
                                                )}
                                            </div>
                                        </CardContent>
                                        <CardFooter>
                                            <Button
                                                className="w-full"
                                                onClick={() => handleUseTemplate(template)}
                                                disabled={usingId === template.id}
                                            >
                                                {usingId === template.id ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Copy className="mr-2 h-4 w-4" />
                                                )}
                                                Use Template
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}

