'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Palette, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type SkinTone = 'cool' | 'neutral' | 'warm'

interface ColorPalette {
    name: string
    colors: string[]
    description: string
}

const PALETTES: Record<SkinTone, ColorPalette[]> = {
    cool: [
        {
            name: 'Royal & Deep',
            colors: ['#002366', '#4B0082', '#004953', '#E5E4E2'],
            description: 'Deep blues, purples, and emerald greens with silver accents.'
        },
        {
            name: 'Icy Pastels',
            colors: ['#B0E0E6', '#E6E6FA', '#F0F8FF', '#D3D3D3'],
            description: 'Powder blue, lavender, and cool greys.'
        }
    ],
    neutral: [
        {
            name: 'Balanced Earth',
            colors: ['#4B3621', '#708090', '#556B2F', '#F5F5DC'],
            description: 'Muted browns, slate grey, and olive green.'
        },
        {
            name: 'Classic Chic',
            colors: ['#000000', '#FFFFFF', '#808080', '#D2B48C'],
            description: 'Black, white, grey, and soft tan.'
        }
    ],
    warm: [
        {
            name: 'Sunset Glow',
            colors: ['#FF4500', '#FFD700', '#B22222', '#8B4513'],
            description: 'Oranges, golden yellows, and rich terracottas.'
        },
        {
            name: 'Autumn Forest',
            colors: ['#556B2F', '#8B0000', '#DAA520', '#DEB887'],
            description: 'Mustard yellow, deep red, and moss green.'
        }
    ]
}

export function SkinToneSuggestions() {
    const [selectedTone, setSelectedTone] = useState<SkinTone>('neutral')

    return (
        <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-background to-primary/5">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        <CardTitle>Color Suggestions</CardTitle>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Info className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-xs text-xs">
                                    Choose colors that complement your skin's undertone for a more vibrant look.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <CardDescription>Clothing combinations for your skin tone</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2">
                    {(['cool', 'neutral', 'warm'] as SkinTone[]).map((tone) => (
                        <Button
                            key={tone}
                            variant={selectedTone === tone ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedTone(tone)}
                            className="capitalize"
                        >
                            {tone} Tone
                        </Button>
                    ))}
                </div>

                <div className="grid gap-4">
                    {PALETTES[selectedTone].map((palette, idx) => (
                        <div key={idx} className="space-y-3 p-3 rounded-lg border bg-background/50 backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">{palette.name}</h4>
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                    Recommended
                                </Badge>
                            </div>
                            <div className="flex gap-2">
                                {palette.colors.map((color, cIdx) => (
                                    <div
                                        key={cIdx}
                                        className="h-10 w-full rounded-md shadow-sm border border-black/5"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {palette.description}
                            </p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
