"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Dumbbell, Timer } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface Workout {
    name: string
    startTime: string
    durationMinutes: number
}

export function FitnessStats() {
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Since we don't have a direct API endpoint for this yet, we'll use the AI command endpoint
        // to fetch the data via the tool we just created.
        // Ideally, we should create a dedicated /api/fitness endpoint.
        const fetchFitnessData = async () => {
            try {
                // For now, let's mock the data or create a dedicated API route.
                // Creating a dedicated API route is better practice.
                const res = await fetch('/api/fitness')
                if (res.ok) {
                    const data = await res.json()
                    setWorkouts(data.workouts || [])
                } else {
                    // If API doesn't exist yet, fail silently or show empty
                    console.log("Fitness API not ready")
                }
            } catch (err) {
                console.error("Failed to fetch fitness data", err)
                setError("Could not load fitness data")
            } finally {
                setLoading(false)
            }
        }

        fetchFitnessData()
    }, [])

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Fitness Routines
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        Loading...
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    Recent Workouts
                </CardTitle>
            </CardHeader>
            <CardContent>
                {workouts.length === 0 ? (
                    <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-sm text-center p-4">
                        <Dumbbell className="h-8 w-8 mb-2 opacity-50" />
                        <p>No recent workouts found in Google Fit.</p>
                        <p className="text-xs mt-1">Make sure you've granted permission.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[200px] pr-4">
                        <div className="space-y-4">
                            {workouts.map((workout, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded-full">
                                            <Dumbbell className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{workout.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(workout.startTime).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                        <Timer className="h-3 w-3" />
                                        {workout.durationMinutes} min
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    )
}
