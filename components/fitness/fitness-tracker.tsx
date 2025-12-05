'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Activity, Footprints } from 'lucide-react'

const WORKOUT_TYPES = [
    'Running',
    'Walking',
    'Cycling',
    'Swimming',
    'Yoga',
    'Weightlifting',
    'HIIT',
    'Pilates',
    'Dancing',
    'Hiking',
    'Other'
]

export function FitnessTracker() {
    const [steps, setSteps] = useState('')
    const [workoutType, setWorkoutType] = useState('')
    const [duration, setDuration] = useState('')
    const [isLogging, setIsLogging] = useState(false)
    const { toast } = useToast()

    const handleLogSteps = async () => {
        if (!steps || parseInt(steps) <= 0) {
            toast({
                title: 'Invalid Input',
                description: 'Please enter a valid number of steps',
                variant: 'destructive'
            })
            return
        }

        setIsLogging(true)
        try {
            const response = await fetch('/api/fitness/steps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steps: parseInt(steps) })
            })

            if (!response.ok) throw new Error('Failed to log steps')

            toast({
                title: 'Steps Logged!',
                description: `Successfully logged ${steps} steps for today`
            })
            setSteps('')
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to log steps. Please try again.',
                variant: 'destructive'
            })
        } finally {
            setIsLogging(false)
        }
    }

    const handleLogWorkout = async () => {
        if (!workoutType || !duration || parseInt(duration) <= 0) {
            toast({
                title: 'Invalid Input',
                description: 'Please select a workout type and enter a valid duration',
                variant: 'destructive'
            })
            return
        }

        setIsLogging(true)
        try {
            const response = await fetch('/api/fitness/workout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: workoutType,
                    durationMinutes: parseInt(duration)
                })
            })

            if (!response.ok) throw new Error('Failed to log workout')

            toast({
                title: 'Workout Logged!',
                description: `Successfully logged ${duration} minutes of ${workoutType}`
            })
            setWorkoutType('')
            setDuration('')
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to log workout. Please try again.',
                variant: 'destructive'
            })
        } finally {
            setIsLogging(false)
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Track Your Activity
                </CardTitle>
                <CardDescription>
                    Log your daily steps and workouts to track your fitness journey
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="steps" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="steps">
                            <Footprints className="h-4 w-4 mr-2" />
                            Steps
                        </TabsTrigger>
                        <TabsTrigger value="workout">
                            <Activity className="h-4 w-4 mr-2" />
                            Workout
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="steps" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="steps">Steps Today</Label>
                            <Input
                                id="steps"
                                type="number"
                                placeholder="Enter your steps (e.g., 8500)"
                                value={steps}
                                onChange={(e) => setSteps(e.target.value)}
                                min="0"
                            />
                        </div>
                        <Button
                            onClick={handleLogSteps}
                            disabled={isLogging}
                            className="w-full"
                        >
                            {isLogging ? 'Logging...' : 'Log Steps'}
                        </Button>
                    </TabsContent>

                    <TabsContent value="workout" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="workout-type">Workout Type</Label>
                            <Select value={workoutType} onValueChange={setWorkoutType}>
                                <SelectTrigger id="workout-type">
                                    <SelectValue placeholder="Select workout type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WORKOUT_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="duration">Duration (minutes)</Label>
                            <Input
                                id="duration"
                                type="number"
                                placeholder="Enter duration (e.g., 30)"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                min="1"
                            />
                        </div>

                        <Button
                            onClick={handleLogWorkout}
                            disabled={isLogging}
                            className="w-full"
                        >
                            {isLogging ? 'Logging...' : 'Log Workout'}
                        </Button>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
