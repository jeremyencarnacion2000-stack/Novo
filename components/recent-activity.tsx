'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, Clock, BookOpen, Briefcase, Heart, GraduationCap } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useChecklist, useRoutines, useProjects } from '@/hooks/use-swr'

interface Activity {
  id?: string
  title: string
  time: string
  completed: boolean
  type: 'routine' | 'task' | 'project' | 'book' | 'business' | 'spiritual' | 'school'
  raw?: any
}

interface RecentActivityProps {
  onActivityClick?: (type: 'routine' | 'project' | 'task', data: any, anchorRect: DOMRect) => void
}

export function RecentActivity({ onActivityClick }: RecentActivityProps) {
  // All 3 fetches fire in parallel — SWR deduplicates with other dashboard components
  const { data: checklistData } = useChecklist()
  const { data: routinesData } = useRoutines()
  const { data: projectsData } = useProjects()

  const activities = useMemo<Activity[]>(() => {
    const result: Activity[] = []

    const checklistItems = Array.isArray(checklistData) ? checklistData : []
    checklistItems
      .filter((item: any) => item.completed)
      .slice(0, 2)
      .forEach((item: any) => {
        result.push({ id: item.id, title: item.text, time: 'Today', completed: true, type: 'task', raw: item })
      })

    const routines = Array.isArray(routinesData) ? routinesData : []
    routines
      .filter((r: any) => r.isActive)
      .slice(0, 2)
      .forEach((routine: any) => {
        result.push({
          id: routine.id,
          title: routine.name,
          time: routine.timeOfDay === 'morning' ? 'Morning' : routine.timeOfDay === 'afternoon' ? 'Afternoon' : 'Evening',
          completed: false,
          type: 'routine',
          raw: routine,
        })
      })

    const projects = Array.isArray(projectsData) ? projectsData : []
    projects
      .filter((p: any) => p.status === 'in-progress')
      .slice(0, 1)
      .forEach((project: any) => {
        result.push({ id: project.id, title: project.title, time: 'Project', completed: false, type: 'project', raw: project })
      })

    return result.slice(0, 6)
  }, [checklistData, routinesData, projectsData])

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
    <Card id="actividad" className="transition-all hover:shadow-s h-full scroll-mt-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="subtitle-technical">Recent Activity</CardTitle>
          <Clock className="h-4 w-4 text-foreground/10" />
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
                onClick={(event) => isClickable && onActivityClick?.(activity.type as any, activity.raw, event.currentTarget.getBoundingClientRect())}
                className={cn(
                  "flex items-center gap-4 group p-3.5 rounded-2xl transition-all duration-300 border border-foreground/[0.04]",
                  isClickable ? "cursor-pointer bg-foreground/[0.03] hover:bg-foreground/[0.08] hover:border-foreground/[0.1] hover:scale-[1.02] active:scale-[0.98]" : "bg-transparent"
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-300 shadow-sm",
                  activity.completed ? 'bg-green-500/10 text-green-400' : 'bg-foreground/5 text-foreground/20 group-hover:bg-primary group-hover:text-foreground'
                )}>
                  <Icon className="h-4 w-4 shrink-0" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight truncate opacity-80 group-hover:opacity-100 transition-opacity">
                    {activity.title}
                  </p>
                  <p className="text-[9px] text-foreground/15 mt-1.5 uppercase tracking-[0.2em] font-black italic">
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
