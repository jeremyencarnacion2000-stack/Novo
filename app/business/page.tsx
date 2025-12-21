'use client'

import React, { useState, useEffect } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Users, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { GoogleContacts } from '@/components/business/google-contacts'
import { DealsPipeline } from '@/components/business/deals-pipeline'
import { BusinessStats } from '@/components/business/business-stats'

interface BusinessClient {
  id: string
  name: string
  status: 'active' | 'proposal' | 'inactive'
  projects: number
  updatedAt: string
}

interface BusinessContentIdea {
  id: string
  title: string
  platform: string
  status: 'draft' | 'scheduled' | 'published'
  updatedAt: string
}

export default function BusinessPage() {
  const [clients, setClients] = useState<BusinessClient[]>([])
  const [contentIdeas, setContentIdeas] = useState<BusinessContentIdea[]>([])
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [contentDialogOpen, setContentDialogOpen] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientStatus, setNewClientStatus] = useState<'active' | 'proposal' | 'inactive'>('proposal')
  const [newContentTitle, setNewContentTitle] = useState('')
  const [newContentPlatform, setNewContentPlatform] = useState('Blog')
  const [newContentStatus, setNewContentStatus] = useState<'draft' | 'scheduled' | 'published'>('draft')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, contentRes] = await Promise.all([
          fetch('/api/business?type=clients'),
          fetch('/api/business?type=content')
        ])

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json()
          setClients(Array.isArray(clientsData) ? clientsData : [])
        }

        if (contentRes.ok) {
          const contentData = await contentRes.json()
          setContentIdeas(Array.isArray(contentData) ? contentData : [])
        }
      } catch (error) {
        console.error('Error fetching business data:', error)
        setClients([])
        setContentIdeas([])
      }
    }
    fetchData()
  }, [])

  const handleAddClient = async () => {
    if (!newClientName.trim()) return

    try {
      const response = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clients',
          name: newClientName,
          status: newClientStatus
        })
      })
      if (response.ok) {
        const newClient = await response.json()
        setClients(prev => [newClient, ...prev])
        setNewClientName('')
        setClientDialogOpen(false)
      }
    } catch (error) {
      console.error('Error adding client:', error)
    }
  }

  const handleAddContent = async () => {
    if (!newContentTitle.trim()) return

    try {
      const response = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'content',
          title: newContentTitle,
          platform: newContentPlatform,
          status: newContentStatus
        })
      })
      if (response.ok) {
        const newContent = await response.json()
        setContentIdeas(prev => [newContent, ...prev])
        setNewContentTitle('')
        setContentDialogOpen(false)
      }
    } catch (error) {
      console.error('Error adding content:', error)
    }
  }

  const handleDeleteClient = async (id: string) => {
    try {
      const response = await fetch(`/api/business?id=${id}&type=clients`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setClients(prev => prev.filter(client => client.id !== id))
      }
    } catch (error) {
      console.error('Error deleting client:', error)
    }
  }

  const handleDeleteContent = async (id: string) => {
    try {
      const response = await fetch(`/api/business?id=${id}&type=content`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setContentIdeas(prev => prev.filter(content => content.id !== id))
      }
    } catch (error) {
      console.error('Error deleting content:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'proposal': return 'bg-yellow-500'
      case 'inactive': return 'bg-gray-500'
      case 'draft': return 'bg-blue-500'
      case 'scheduled': return 'bg-orange-500'
      case 'published': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Business</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Manage clients and content ideas
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setClientDialogOpen(true)} variant="outline" className="w-full sm:w-auto">
            <Users className="h-4 w-4 mr-2" />
            Add Client
          </Button>
          <Button onClick={() => setContentDialogOpen(true)} className="w-full sm:w-auto">
            <FileText className="h-4 w-4 mr-2" />
            Add Content
          </Button>
        </div>
      </div>

      {/* Business Analytics Stats */}
      <BusinessStats />

      {/* Deals Pipeline */}
      <DealsPipeline />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clients ({clients.length})
            </CardTitle>
            <CardDescription>Manage your business clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clients.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No clients yet</p>
              ) : (
                clients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${getStatusColor(client.status)}`} />
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {client.projects} projects • {client.status}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClient(client.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Content Ideas ({contentIdeas.length})
            </CardTitle>
            <CardDescription>Track your content creation ideas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contentIdeas.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No content ideas yet</p>
              ) : (
                contentIdeas.map((content) => (
                  <div key={content.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${getStatusColor(content.status)}`} />
                      <div>
                        <p className="font-medium">{content.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {content.platform} • {content.status}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteContent(content.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <GoogleContacts />

      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Add a new business client to track</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name</Label>
              <Input
                id="client-name"
                placeholder="e.g., ABC Company"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-status">Status</Label>
              <Select value={newClientStatus} onValueChange={(v: any) => setNewClientStatus(v)}>
                <SelectTrigger>
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
            <Button variant="outline" onClick={() => setClientDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClient}>Add Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contentDialogOpen} onOpenChange={setContentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Content Idea</DialogTitle>
            <DialogDescription>Add a new content creation idea</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="content-title">Title</Label>
              <Input
                id="content-title"
                placeholder="e.g., 10 Tips for Productivity"
                value={newContentTitle}
                onChange={(e) => setNewContentTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-platform">Platform</Label>
              <Input
                id="content-platform"
                placeholder="e.g., Blog, YouTube, LinkedIn"
                value={newContentPlatform}
                onChange={(e) => setNewContentPlatform(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-status">Status</Label>
              <Select value={newContentStatus} onValueChange={(v: any) => setNewContentStatus(v)}>
                <SelectTrigger>
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
            <Button variant="outline" onClick={() => setContentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddContent}>Add Content</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}