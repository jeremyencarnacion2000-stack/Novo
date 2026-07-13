'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { DollarSign, Plus, Trash2, ArrowRight } from 'lucide-react'
import { useModalFlip } from '@/hooks/use-modal-flip'

interface Deal {
    id: string
    title: string
    value: number
    stage: string
    probability: number
    expectedClose: string | null
    notes: string | null
    client: {
        id: string
        name: string
        company: string | null
    }
}

interface Client {
    id: string
    name: string
}

const STAGES = [
    { id: 'lead', label: 'Lead', color: 'bg-gray-500' },
    { id: 'qualified', label: 'Qualified', color: 'bg-blue-500' },
    { id: 'proposal', label: 'Proposal', color: 'bg-yellow-500' },
    { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
    { id: 'won', label: 'Won', color: 'bg-green-500' },
    { id: 'lost', label: 'Lost', color: 'bg-red-500' },
]

export function DealsPipeline() {
    const [deals, setDeals] = useState<Deal[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [newDeal, setNewDeal] = useState({
        title: '',
        value: '',
        stage: 'lead',
        probability: 50,
        clientId: '',
    })

    useEffect(() => {
        fetchDeals()
        fetchClients()
    }, [])

    const closeDealFlip = useModalFlip('btn-new-deal', dialogOpen)

    const handleDialogChange = (o: boolean) => {
        if (!o) closeDealFlip(() => setDialogOpen(false))
        else setDialogOpen(true)
    }

    const fetchDeals = async () => {
        try {
            const response = await fetch('/api/business/deals')
            if (response.ok) {
                const data = await response.json()
                setDeals(data.deals || [])
            }
        } catch (error) {
            console.error('Error fetching deals:', error)
        }
    }

    const fetchClients = async () => {
        try {
            const response = await fetch('/api/business?type=clients')
            if (response.ok) {
                const data = await response.json()
                setClients(Array.isArray(data) ? data : [])
            }
        } catch (error) {
            console.error('Error fetching clients:', error)
        }
    }

    const handleAddDeal = async () => {
        if (!newDeal.title.trim() || !newDeal.clientId) return

        try {
            const response = await fetch('/api/business/deals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDeal),
            })
            if (response.ok) {
                fetchDeals()
                setNewDeal({ title: '', value: '', stage: 'lead', probability: 50, clientId: '' })
                handleDialogChange(false)
            }
        } catch (error) {
            console.error('Error adding deal:', error)
        }
    }

    const handleUpdateStage = async (dealId: string, newStage: string) => {
        try {
            await fetch(`/api/business/deals/${dealId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: newStage }),
            })
            fetchDeals()
        } catch (error) {
            console.error('Error updating deal:', error)
        }
    }

    const handleDeleteDeal = async (dealId: string) => {
        try {
            await fetch(`/api/business/deals/${dealId}`, { method: 'DELETE' })
            setDeals(prev => prev.filter(d => d.id !== dealId))
        } catch (error) {
            console.error('Error deleting deal:', error)
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(value)
    }

    const getDealsByStage = (stage: string) => deals.filter(d => d.stage === stage)

    return (
        <Card className="liquid-glass">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Deals Pipeline
                </CardTitle>
                <Button size="sm" data-flip-from="btn-new-deal" onClick={() => setDialogOpen(true)}>
                    <Plus data-shared-item="icon" className="h-4 w-4 mr-1" />
                    <span data-shared-item="text">New Deal</span>
                </Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="flex gap-4 min-w-max pb-4">
                        {STAGES.slice(0, 5).map((stage) => (
                            <div key={stage.id} className="w-56 shrink-0">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                                    <span className="text-sm font-medium">{stage.label}</span>
                                    <Badge variant="secondary" className="ml-auto">
                                        {getDealsByStage(stage.id).length}
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    {getDealsByStage(stage.id).map((deal) => (
                                        <div
                                            key={deal.id}
                                            className="p-4 rounded-[20px] bg-foreground/[0.03] border border-foreground/[0.04] hover:bg-foreground/[0.06] transition-colors duration-300"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <p className="font-medium text-sm truncate flex-1">{deal.title}</p>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 shrink-0"
                                                    onClick={() => handleDeleteDeal(deal.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <p className="text-lg font-bold text-primary">{formatCurrency(deal.value)}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {deal.client?.name || 'No client'}
                                            </p>
                                            {stage.id !== 'won' && stage.id !== 'lost' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full mt-2 text-xs"
                                                    onClick={() => {
                                                        const currentIdx = STAGES.findIndex(s => s.id === stage.id)
                                                        if (currentIdx < STAGES.length - 2) {
                                                            handleUpdateStage(deal.id, STAGES[currentIdx + 1].id)
                                                        }
                                                    }}
                                                >
                                                    Move <ArrowRight className="h-3 w-3 ml-1" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>

            <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
                <DialogContent data-flip-to="btn-new-deal" flipAnchored className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus data-shared-item="icon" className="h-5 w-5" />
                            <span data-shared-item="text">New Deal</span>
                        </DialogTitle>
                        <DialogDescription>Add a new deal to your pipeline</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                                value={newDeal.title}
                                onChange={(e) => setNewDeal(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Deal title"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Value ($)</Label>
                            <Input
                                type="number"
                                value={newDeal.value}
                                onChange={(e) => setNewDeal(prev => ({ ...prev, value: e.target.value }))}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Client</Label>
                            <Select
                                value={newDeal.clientId}
                                onValueChange={(v) => setNewDeal(prev => ({ ...prev, clientId: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Stage</Label>
                            <Select
                                value={newDeal.stage}
                                onValueChange={(v) => setNewDeal(prev => ({ ...prev, stage: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STAGES.map((stage) => (
                                        <SelectItem key={stage.id} value={stage.id}>
                                            {stage.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleDialogChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddDeal}>Add Deal</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
