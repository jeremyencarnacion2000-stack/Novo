'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Flame, Target, TrendingUp, BookOpen, Briefcase, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Metric {
  title: string
  value: string
  description: string
  icon: any
  color: string
}

export function DashboardMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([
    {
      title: 'Tasks Completed',
      value: '0',
      description: 'Today',
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Current Streak',
      value: '0 days',
      description: 'Keep it up!',
      icon: Flame,
      color: 'text-orange-600 dark:text-orange-400',
    },
    {
      title: 'Active Projects',
      value: '0',
      description: 'In progress',
      icon: Target,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Week Progress',
      value: '0%',
      description: 'On track',
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
    },
  ])

  useEffect(() => {
    const checklistItems = JSON.parse(localStorage.getItem('checklist-items') || '[]')
    const completedToday = checklistItems.filter((item: any) => item.completed).length
    
    const projects = JSON.parse(localStorage.getItem('novo-projects') || '[]')
    const activeProjects = projects.filter((p: any) => p.status === 'in-progress').length
    
    const routines = JSON.parse(localStorage.getItem('routines') || '[]')
    
    // New modules data
    const books = JSON.parse(localStorage.getItem('novo_books') || '[]')
    const readingBooks = books.filter((b: any) => b.status === 'reading').length
    
    const clients = JSON.parse(localStorage.getItem('novo_clients') || '[]')
    const activeClients = clients.filter((c: any) => c.status === 'active').length
    
    const subjects = JSON.parse(localStorage.getItem('novo_school_subjects') || '[]')
    const gpa = subjects.length > 0 
      ? (subjects.reduce((acc: number, s: any) => {
          const grades = s.grades || []
          if (grades.length === 0) return acc
          const avg = grades.reduce((sum: number, g: any) => sum + g.grade, 0) / grades.length
          return acc + avg
        }, 0) / subjects.length).toFixed(1)
      : '0.0'

    // Calculate streak from checklist history
    const streak = calculateStreak()
    
    // Calculate week progress
    const weekProgress = calculateWeekProgress(checklistItems, routines)
    
    const newMetrics = [
      {
        title: 'Tasks Completed',
        value: completedToday.toString(),
        description: 'Today',
        icon: CheckCircle2,
        color: 'text-green-600 dark:text-green-400',
      },
      {
        title: 'Current Streak',
        value: `${streak} ${streak === 1 ? 'day' : 'days'}`,
        description: streak > 0 ? 'Keep it up!' : 'Start today!',
        icon: Flame,
        color: 'text-orange-600 dark:text-orange-400',
      },
      {
        title: 'Active Projects',
        value: activeProjects.toString(),
        description: 'In progress',
        icon: Target,
        color: 'text-blue-600 dark:text-blue-400',
      },
      {
        title: 'Week Progress',
        value: `${weekProgress}%`,
        description: weekProgress >= 70 ? 'Excellent!' : weekProgress >= 40 ? 'On track' : 'Keep going',
        icon: TrendingUp,
        color: 'text-purple-600 dark:text-purple-400',
      }
    ]

    // Dynamically add metrics based on usage
    if (readingBooks > 0) {
      newMetrics.push({
        title: 'Reading',
        value: readingBooks.toString(),
        description: 'Books in progress',
        icon: BookOpen,
        color: 'text-indigo-600 dark:text-indigo-400',
      })
    }

    if (activeClients > 0) {
      newMetrics.push({
        title: 'Active Clients',
        value: activeClients.toString(),
        description: 'Business',
        icon: Briefcase,
        color: 'text-slate-600 dark:text-slate-400',
      })
    }

    if (subjects.length > 0) {
      newMetrics.push({
        title: 'Current GPA',
        value: gpa,
        description: 'Academic',
        icon: GraduationCap,
        color: 'text-yellow-600 dark:text-yellow-400',
      })
    }
    
    // Limit to 4 metrics for layout consistency, prioritizing the most relevant ones
    // Or we can show all in a grid that wraps
    setMetrics(newMetrics.slice(0, 4))
  }, [])

  const calculateStreak = () => {
    const history = JSON.parse(localStorage.getItem('activity-history') || '{}')
    let streak = 0
    const today = new Date()
    
    for (let i = 0; i < 365; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split('T')[0]
      
      if (history[dateKey] && history[dateKey].completed > 0) {
        streak++
      } else if (i > 0) {
        break
      }
    }
    
    return streak
  }

  const calculateWeekProgress = (items: any[], routines: any[]) => {
    const totalTasks = items.length + routines.length
    const completed = items.filter((i: any) => i.completed).length + routines.filter((r: any) => r.isActive).length
    
    if (totalTasks === 0) return 0
    return Math.round((completed / totalTasks) * 100)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <Card key={metric.title} className="transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
