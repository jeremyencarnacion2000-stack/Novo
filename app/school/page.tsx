'use client'

import { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, FileText, Calendar, Trash2, TrendingUp, TrendingDown, Minus, BookOpen } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
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
import { useSchool } from '@/hooks/use-swr'
import { useToast } from '@/hooks/use-toast'

interface SchoolEvent {
  id: string
  title: string
  date: string
  type: 'exam' | 'assignment' | 'project'
  completed: boolean
}

interface Subject {
  id: string
  name: string
  grades: { period: string; grade: number }[]
  events: SchoolEvent[]
  color: string
}

export default function SchoolPage() {
  const { data: subjects, error, isLoading, mutate } = useSchool()
  const { toast } = useToast()

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error fetching school subjects',
        description: 'Could not fetch school subjects. Please try again later.',
        variant: 'destructive',
      })
    }
  }, [error, toast])


  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false)
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newGradePeriod, setNewGradePeriod] = useState('')
  const [newGradeValue, setNewGradeValue] = useState('')
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventType, setNewEventType] = useState<'exam' | 'assignment' | 'project'>('assignment')

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
  ]

  const calculateAverage = (grades: { period: string; grade: number }[]) => {
    if (grades.length === 0) return 0
    const sum = grades.reduce((acc, g) => acc + g.grade, 0)
    return Math.round(sum / grades.length)
  }

  const calculateOverallGPA = () => {
    if (!subjects || subjects.length === 0) return '0.0'
    const totalAverage = subjects.reduce((acc, subject) => {
      return acc + calculateAverage(subject.grades)
    }, 0)
    return (totalAverage / subjects.length).toFixed(1)
  }

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return

    try {
      const response = await fetch('/api/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSubjectName,
          events: [],
          grades: []
        })
      })
      if (response.ok) {
        mutate()
        setNewSubjectName('')
        setSubjectDialogOpen(false)
        toast({
          title: 'Subject added',
          description: 'Your new subject has been added successfully.',
        })
      } else {
        toast({
            title: 'Error adding subject',
            description: 'Could not add subject. Please try again later.',
            variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error adding subject:', error)
      toast({
        title: 'Error adding subject',
        description: 'Could not add subject. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteSubject = async (id: string) => {
    try {
      const response = await fetch(`/api/school/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        mutate()
        toast({
            title: 'Subject deleted',
            description: 'Your subject has been deleted successfully.',
        })
      } else {
        toast({
            title: 'Error deleting subject',
            description: 'Could not delete subject. Please try again later.',
            variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting subject:', error)
      toast({
        title: 'Error deleting subject',
        description: 'Could not delete subject. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleOpenGradeDialog = (subject: Subject) => {
    setSelectedSubject(subject)
    setGradeDialogOpen(true)
  }

  const handleAddGrade = async () => {
    if (!selectedSubject || !newGradePeriod || !newGradeValue) return

    const gradeNum = parseFloat(newGradeValue)
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) return

    const updatedSubject = {
      ...selectedSubject,
      grades: [...selectedSubject.grades, { period: newGradePeriod, grade: gradeNum }]
    }

    try {
      const response = await fetch(`/api/school/${selectedSubject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSubject)
      })
      if (response.ok) {
        mutate()
        setNewGradePeriod('')
        setNewGradeValue('')
        setGradeDialogOpen(false)
        setSelectedSubject(null)
        toast({
            title: 'Grade added',
            description: 'Your grade has been added successfully.',
        })
      } else {
        toast({
            title: 'Error adding grade',
            description: 'Could not add grade. Please try again later.',
            variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error adding grade:', error)
      toast({
        title: 'Error adding grade',
        description: 'Could not add grade. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleOpenEventDialog = (subject: Subject) => {
    setSelectedSubject(subject)
    setEventDialogOpen(true)
  }

  const handleAddEvent = async () => {
    if (!selectedSubject || !newEventTitle || !newEventDate) return

    const newEvent: SchoolEvent = {
      id: Date.now().toString(),
      title: newEventTitle,
      date: newEventDate,
      type: newEventType,
      completed: false
    }

    const updatedSubject = {
      ...selectedSubject,
      events: [...(selectedSubject.events || []), newEvent]
    }

    try {
      const response = await fetch(`/api/school/${selectedSubject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSubject)
      })
      if (response.ok) {
        mutate()
        setNewEventTitle('')
        setNewEventDate('')
        setEventDialogOpen(false)
        setSelectedSubject(null)
        toast({
            title: 'Event added',
            description: 'Your event has been added successfully.',
        })
      } else {
        toast({
            title: 'Error adding event',
            description: 'Could not add event. Please try again later.',
            variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error adding event:', error)
      toast({
        title: 'Error adding event',
        description: 'Could not add event. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteEvent = async (subjectId: string, eventId: string) => {
    const subject = subjects?.find(s => s.id === subjectId)
    if (!subject) return

    const updatedSubject = {
      ...subject,
      events: (Array.isArray(subject.events) ? subject.events : []).filter((e) => e.id !== eventId)
    }

    try {
      const response = await fetch(`/api/school/${subjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSubject)
      })
      if (response.ok) {
        mutate()
        toast({
            title: 'Event deleted',
            description: 'Your event has been deleted successfully.',
        })
      } else {
        toast({
            title: 'Error deleting event',
            description: 'Could not delete event. Please try again later.',
            variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      toast({
        title: 'Error deleting event',
        description: 'Could not delete event. Please try again later.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">School</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Track subjects, grades, and academic progress
            </p>
          </div>
          <Button onClick={() => setSubjectDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Subject
          </Button>
        </div>

        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Overall Average</CardTitle>
            <CardDescription>Your current GPA across all subjects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-primary">{calculateOverallGPA()}</div>
              <div className="flex-1">
                <Progress value={parseFloat(calculateOverallGPA())} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">
                  Based on {subjects?.length} {subjects?.length === 1 ? 'subject' : 'subjects'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {subjects?.map((subject) => {
            const average = calculateAverage(subject.grades)
            const lastGrade = subject.grades[subject.grades.length - 1]
            const previousGrade = subject.grades[subject.grades.length - 2]
            const trend = lastGrade && previousGrade ? lastGrade.grade - previousGrade.grade : 0

            return (
              <Card key={subject.id} className="relative flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{subject.name}</CardTitle>
                      <CardDescription>
                        {subject.grades.length} {subject.grades.length === 1 ? 'period' : 'periods'}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteSubject(subject.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-14 w-14 rounded-full ${subject.color} flex items-center justify-center text-white font-bold text-xl`}
                      >
                        {average || '-'}
                      </div>
                      <div className="flex-1">
                        {average > 0 && (
                          <>
                            <Progress value={average} className="h-2 mb-2" />
                            {trend !== 0 && (
                              <div className="flex items-center gap-1 text-xs">
                                {trend > 0 ? (
                                  <>
                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                    <span className="text-green-500">+{trend.toFixed(1)}</span>
                                  </>
                                ) : (
                                  <>
                                    <TrendingDown className="h-3 w-3 text-red-500" />
                                    <span className="text-red-500">{trend.toFixed(1)}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {subject.grades.length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <h4 className="text-xs font-semibold text-muted-foreground">Grades by Period</h4>
                        {subject.grades.map((grade, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{grade.period}</span>
                            <span className="font-medium">{grade.grade}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-muted-foreground">Upcoming Events</h4>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0"
                          onClick={() => handleOpenEventDialog(subject)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {(!subject.events || subject.events.length === 0) && (
                        <p className="text-xs text-muted-foreground italic">No upcoming events</p>
                      )}

                      {(subject.events || []).map((event) => (
                        <div key={event.id} className="flex items-center justify-between text-sm bg-secondary/30 p-2 rounded-md">
                          <div className="flex flex-col">
                            <span className="font-medium text-xs">{event.title}</span>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="capitalize">{event.type}</span>
                              <span>•</span>
                              <span>{new Date(event.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDeleteEvent(subject.id, event.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleOpenGradeDialog(subject)}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Add Grade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Subject</DialogTitle>
              <DialogDescription>Create a new subject to track grades and progress</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="subject-name">Subject Name</Label>
                <Input
                  id="subject-name"
                  placeholder="e.g., Mathematics"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSubject}>Add Subject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Grade</DialogTitle>
              <DialogDescription>
                Add a grade for {selectedSubject?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Input
                  id="period"
                  placeholder="e.g., Period 1, Midterm, Final"
                  value={newGradePeriod}
                  onChange={(e) => setNewGradePeriod(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade (0-100)</Label>
                <Input
                  id="grade"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g., 95"
                  value={newGradeValue}
                  onChange={(e) => setNewGradeValue(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGradeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddGrade}>Add Grade</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add School Event</DialogTitle>
              <DialogDescription>
                Add an exam, assignment, or project for {selectedSubject?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="event-title">Title</Label>
                <Input
                  id="event-title"
                  placeholder="e.g., Midterm Exam"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-type">Type</Label>
                <Select 
                  value={newEventType} 
                  onValueChange={(v: any) => setNewEventType(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEvent}>Add Event</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  )
}