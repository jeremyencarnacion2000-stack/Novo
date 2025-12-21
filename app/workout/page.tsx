import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dumbbell, Play } from 'lucide-react'
import Link from 'next/link'

export default function WorkoutPage() {
    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Active Workout</h1>
                <p className="text-muted-foreground">
                    Select a routine to start your session.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Dumbbell className="h-5 w-5 text-indigo-500" />
                            Quick Start
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Start an empty workout session and log exercises as you go.
                        </p>
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                            <Play className="mr-2 h-4 w-4" /> Start Session
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>My Routines</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Browse your saved routines to start a specific workout.
                        </p>
                        <Button variant="outline" className="w-full" asChild>
                            <Link href="/routines">View Routines</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
