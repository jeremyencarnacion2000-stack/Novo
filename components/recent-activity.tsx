'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, Clock, BookOpen, Briefcase, Heart, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Activity {
  title: string
  time: string
  completed: boolean
  type: 'routine' | 'task' | 'project' | 'book' | 'business' | 'spiritual' | 'school'
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    const recentActivities: Activity[] = []
    
    // Get completed tasks from today
    const checklistItems = JSON.parse(localStorage.getItem('checklist-items') || '[]')
    checklistItems
      .filter((item: any) => item.completed)
      .slice(0, 2)
      .forEach((item: any) => {
        recentActivities.push({
          title: item.text,
          time: 'Today',
          completed: true,
          type: 'task',
        })
      })
    
    // Get active routines
    const routines = JSON.parse(localStorage.getItem('routines') || '[]')
    routines
      .filter((r: any) => r.isActive)
      .slice(0, 2)
      .forEach((routine: any) => {
        recentActivities.push({
          title: routine.name,
          time: routine.timeOfDay === 'morning' ? 'Morning' : routine.timeOfDay === 'afternoon' ? 'Afternoon' : 'Evening',
          completed: false,
          type: 'routine',
        })
      })
    
    // Get in-progress projects
    const projects = JSON.parse(localStorage.getItem('novo-projects') || '[]')
    projects
      .filter((p: any) => p.status === 'in-progress')
      .slice(0, 1)
      .forEach((project: any) => {
        recentActivities.push({
          title: project.title,
          time: 'Project',
          completed: false,
          type: 'project',
        })
      })

    // Get recent books
    const books = JSON.parse(localStorage.getItem('novo_books') || '[]')
    books
      .filter((b: any) => b.status === 'reading')
      .slice(0, 1)
      .forEach((book: any) => {
        recentActivities.push({
          title: `Reading: ${book.title}`,
          time: `${book.progress}%`,
          completed: false,
          type: 'book',
        })
      })

    // Get recent gratitude
    const gratitudes = JSON.parse(localStorage.getItem('novo_gratitudes') || '[]')
    if (gratitudes.length > 0) {
      recentActivities.push({
        title: 'Gratitude Journaled',
        time: 'Spiritual',
        completed: true,
        type: 'spiritual',
      })
    }

    // Sort randomly or by some logic to mix them up, for now just slice
    // In a real app we'd have timestamps for everything
    
    // If no activities, show placeholder
    if (recentActivities.length === 0) {
      recentActivities.push(
        {
          title: 'Create your first routine',
          time: 'Get started',
          completed: false,
          type: 'routine',
        },
        {
          title: 'Add tasks to checklist',
          time: 'Stay organized',
          completed: false,
          type: 'task',
        }
      )
    }
    
    setActivities(recentActivities.slice(0, 6))
  }, [])

  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'book': return BookOpen
      case 'business': return Briefcase
      case 'spiritual': return Heart
      case 'school': return GraduationCap
      default: return Circle
    }
  }

  return (
    <Card className="transition-all hover:shadow-md h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = activity.completed ? CheckCircle2 : getIcon(activity.type)
            return (
              <div key={index} className="flex items-center gap-3 group">
                <Icon className={`h-4 w-4 shrink-0 ${
                  activity.completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-none truncate group-hover:text-primary transition-colors">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.time}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
