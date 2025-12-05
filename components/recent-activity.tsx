'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, Clock, BookOpen, Briefcase, Heart, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface Activity {
  title: string
  time: string
  completed: boolean
  type: 'routine' | 'task' | 'project' | 'book' | 'business' | 'spiritual' | 'school'
}

export function RecentActivity() {
  const { data: session } = useSession()
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {

    const fetchActivities = async () => {
      // Prevent API calls if the user is not authenticated
      if (!session?.user) {
        setActivities([]) // Clear activities or set a placeholder
        return
      }

      const recentActivities: Activity[] = []

      try {
        // Get completed tasks from today
        const checklistRes = await fetch('/api/checklist')
        const checklistData = checklistRes.ok ? await checklistRes.json().catch(() => []) : []
        const checklistItems = Array.isArray(checklistData) ? checklistData : []
        const itemsArray = Array.isArray(checklistItems) ? checklistItems : []
        itemsArray
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
      } catch (error) {
        console.error('Failed to fetch checklist:', error)
      }

      try {
        // Get active routines
        const routinesRes = await fetch('/api/routines')
        const routinesData = routinesRes.ok ? await routinesRes.json().catch(() => []) : []
        const routines = Array.isArray(routinesData) ? routinesData : []
        const routinesArray = Array.isArray(routines) ? routines : []
        routinesArray
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
      } catch (error) {
        console.error('Failed to fetch routines:', error)
      }

      try {
        // Get in-progress projects
        const projectsRes = await fetch('/api/projects')
        const projectsData = projectsRes.ok ? await projectsRes.json().catch(() => []) : []
        const projects = Array.isArray(projectsData) ? projectsData : []
        const projectsArray = Array.isArray(projects) ? projects : []
        projectsArray
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
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      }

      try {
        // Get recent books
        const booksRes = await fetch('/api/books')
        const booksData = booksRes.ok ? await booksRes.json().catch(() => []) : []
        const books = Array.isArray(booksData) ? booksData : []
        const booksArray = Array.isArray(books) ? books : []
        booksArray
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
      } catch (error) {
        console.error('Failed to fetch books:', error)
      }

      try {
        // Get recent gratitude
        const gratitudesRes = await fetch('/api/gratitudes')
        const gratitudesData = gratitudesRes.ok ? await gratitudesRes.json().catch(() => []) : []
        const gratitudes = Array.isArray(gratitudesData) ? gratitudesData : []
        const gratitudesArray = Array.isArray(gratitudes) ? gratitudes : []
        if (gratitudesArray.length > 0) {
          recentActivities.push({
            title: 'Gratitude Journaled',
            time: 'Spiritual',
            completed: true,
            type: 'spiritual',
          })
        }
      } catch (error) {
        console.error('Failed to fetch gratitudes:', error)
      }

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
    }

    fetchActivities()
  }, [session?.user?.id])

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
                <Icon className={`h-4 w-4 shrink-0 ${activity.completed ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
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
