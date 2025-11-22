'use client'

import { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Users, Briefcase, PenTool, TrendingUp, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface Client {
  id: string
  name: string
  status: 'active' | 'proposal' | 'inactive'
  projects: number
}

interface ContentIdea {
  id: string
  title: string
  platform: string
  status: 'draft' | 'scheduled' | 'published'
}

export default function BusinessPage() {
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[]>([])
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false)
  
  const [newClient, setNewClient] = useState<{ name: string; status: 'active' | 'proposal' | 'inactive'; projects: number }>({ name: '', status: 'proposal', projects: 0 })
  const [newContent, setNewContent] = useState<{ title: string; platform: string; status: 'draft' | 'scheduled' | 'published' }>({ title: '', platform: 'Blog', status: 'draft' })

  useEffect(() => {
    const savedClients = localStorage.getItem('novo_clients')
    const savedContent = localStorage.getItem('novo_content_ideas')
    
    if (savedClients) {
      setClients(JSON.parse(savedClients))
    } else {
      setClients([
        { id: '1', name: 'Tech Startup Inc', status: 'active', projects: 2 },
        { id: '2', name: 'Design Agency', status: 'proposal', projects: 1 },
      ])
    }
    
    if (savedContent) {
      setContentIdeas(JSON.parse(savedContent))
    } else {
      setContentIdeas([
        { id: '1', title: 'Building scalable web apps', platform: 'Blog', status: 'draft' },
        { id: '2', title: 'Design tips for developers', platform: 'Social', status: 'scheduled' },
      ])
    }
  }, [])

  useEffect(() => {
    if (clients.length > 0) {
      localStorage.setItem('novo_clients', JSON.stringify(clients))
    }
  }, [clients])

  useEffect(() => {
    if (contentIdeas.length > 0) {
      localStorage.setItem('novo_content_ideas', JSON.stringify(contentIdeas))
    }
  }, [contentIdeas])

  const handleAddClient = () => {
    if (!newClient.name.trim()) {
      toast({ title: 'Error', description: 'Please enter a client name', variant: 'destructive' })
      return
    }
    
    const client: Client = {
      id: Date.now().toString(),
      name: newClient.name,
      status: newClient.status,
      projects: 0
    }
    
    setClients([...clients, client])
    setNewClient({ name: '', status: 'proposal', projects: 0 })
    setIsClientDialogOpen(false)
    toast({ title: 'Success', description: 'Client added successfully' })
  }

  const handleAddContent = () => {
    if (!newContent.title.trim()) {
      toast({ title: 'Error', description: 'Please enter a title', variant: 'destructive' })
      return
    }
    
    const content: ContentIdea = {
      id: Date.now().toString(),
      title: newContent.title,
      platform: newContent.platform,
      status: newContent.status
    }
    
    setContentIdeas([...contentIdeas, content])
    setNewContent({ title: '', platform: 'Blog', status: 'draft' })
    setIsContentDialogOpen(false)
    toast({ title: 'Success', description: 'Content idea added successfully' })
  }

  const handleDeleteClient = (id: string) => {
    setClients(clients.filter(c => c.id !== id))
    toast({ title: 'Client removed' })
  }

  const handleDeleteContent = (id: string) => {
    setContentIdeas(contentIdeas.filter(c => c.id !== id))
    toast({ title: 'Content idea removed' })
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Novo Business</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Manage clients, projects, and content pipeline
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Clients</CardDescription>
              <CardTitle className="text-3xl">{clients.filter(c => c.status === 'active').length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Projects</CardDescription>
              <CardTitle className="text-3xl">{clients.reduce((sum, c) => sum + c.projects, 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Content Ideas</CardDescription>
              <CardTitle className="text-3xl">{contentIdeas.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <PenTool className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Revenue (MTD)</CardDescription>
              <CardTitle className="text-3xl">$4.2k</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>CRM Pipeline</CardTitle>
                <CardDescription>Client relationships</CardDescription>
              </div>
              <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Client</DialogTitle>
                    <DialogDescription>Add a new client to your CRM pipeline</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="client-name">Client Name</Label>
                      <Input
                        id="client-name"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        placeholder="Enter client name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-status">Status</Label>
                      <Select
                        value={newClient.status}
                        onValueChange={(value: 'active' | 'proposal' | 'inactive') =>
                          setNewClient({ ...newClient, status: value })
                        }
                      >
                        <SelectTrigger id="client-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddClient}>Add Client</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">{client.name}</h3>
                      <p className="text-sm text-muted-foreground">{client.projects} projects</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                        {client.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClient(client.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Content Pipeline</CardTitle>
                <CardDescription>Blog & social media</CardDescription>
              </div>
              <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Idea
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Content Idea</DialogTitle>
                    <DialogDescription>Add a new content idea to your pipeline</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="content-title">Title</Label>
                      <Input
                        id="content-title"
                        value={newContent.title}
                        onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                        placeholder="Enter content title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="content-platform">Platform</Label>
                      <Select
                        value={newContent.platform}
                        onValueChange={(value) => setNewContent({ ...newContent, platform: value })}
                      >
                        <SelectTrigger id="content-platform">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Blog">Blog</SelectItem>
                          <SelectItem value="Social">Social Media</SelectItem>
                          <SelectItem value="Video">Video</SelectItem>
                          <SelectItem value="Podcast">Podcast</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="content-status">Status</Label>
                      <Select
                        value={newContent.status}
                        onValueChange={(value: 'draft' | 'scheduled' | 'published') =>
                          setNewContent({ ...newContent, status: value })
                        }
                      >
                        <SelectTrigger id="content-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddContent}>Add Idea</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contentIdeas.map((idea) => (
                  <div key={idea.id} className="flex items-start justify-between gap-2 p-3 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-2">{idea.title}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{idea.platform}</Badge>
                        <Badge variant="secondary" className="text-xs">{idea.status}</Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteContent(idea.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
