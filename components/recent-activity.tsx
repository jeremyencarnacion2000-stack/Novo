'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, Clock, BookOpen, Briefcase, Heart, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

interface Activity {
  id?: string
  title: string
  time: string
  completed: boolean
  type: 'routine' | 'task' | 'project' | 'book' | 'business' | 'spiritual' | 'school'
  raw?: any // Store the raw object if available
}

interface RecentActivityProps {
  onActivityClick?: (type: 'routine' | 'project' | 'task', data: any) => void
}

export function RecentActivity({ onActivityClick }: RecentActivityProps) {
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
              id: item.id,
              title: item.text,
              time: 'Today',
              completed: true,
              type: 'task',
              raw: item
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
              id: routine.id,
              title: routine.name,
              time: routine.timeOfDay === 'morning' ? 'Morning' : routine.timeOfDay === 'afternoon' ? 'Afternoon' : 'Evening',
              completed: false,
              type: 'routine',
              raw: routine
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
              id: project.id,
              title: project.title,
              time: 'Project',
              completed: false,
              type: 'project',
              raw: project
            })
          })
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      }

      // ... (rest of book/spiritual fetch remains same logic-wise)
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
    <Card className="transition-all hover:shadow-s h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="subtitle-technical">Recent Activity</CardTitle>
          <Clock className="h-4 w-4 text-white/10" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, index) => {
            const Icon = activity.completed ? CheckCircle2 : getIcon(activity.type)
            const isClickable = ['routine', 'project', 'task'].includes(activity.type)

            return (
              <div
                key={index}
                onClick={() => isClickable && onActivityClick?.(activity.type as any, activity.raw)}
                className={cn(
                  "flex items-center gap-4 group p-3.5 rounded-2xl transition-all duration-300 border border-white/[0.04]",
                  isClickable ? "cursor-pointer bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/[0.1] hover:scale-[1.02] active:scale-[0.98]" : "bg-transparent"
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300 shadow-sm",
                  activity.completed ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/20 group-hover:bg-primary group-hover:text-white'
                )}>
                  <Icon className="h-4 w-4 shrink-0" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight truncate opacity-80 group-hover:opacity-100 transition-opacity">
                    {activity.title}
                  </p>
                  <p className="text-[9px] text-white/15 mt-1.5 uppercase tracking-[0.2em] font-black italic">
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
