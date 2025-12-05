import useSWR from 'swr'
import { ChecklistItem } from '@/types/checklist'
import { Routine } from '@/types/routine'
import { Project, Task } from '@/types/project'
import { Book } from '@/types/book'
import { Gratitude } from '@/types/gratitude'
import { Client } from '@/types/client'
import { Subject } from '@/types/subject'
import { ActivityHistory } from '@/types/activity-history'
import { AnalyticsData } from '@/types/analytics'
import { SchoolSubject, CalendarEvent, IntegratedTask } from '@/lib/data-integrator'
import { Tracker } from '@/types/tracker'

// Fetcher function
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('An error occurred while fetching the data.')
  }
  return res.json()
}

// Generic SWR hook with common config
export const useSWRWithConfig = <T>(key: string | null, config?: any) => {
  return useSWR<T>(key, fetcher, {
    dedupingInterval: 5000, // 5 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: true,
    errorRetryCount: 3,
    ...config
  })
}

// Checklist hooks
export const useChecklist = () => {
  return useSWRWithConfig<ChecklistItem[]>('/api/checklist')
}

// Routines hooks
export const useRoutines = () => {
  return useSWRWithConfig<Routine[]>('/api/routines')
}

// Projects hooks
export const useProjects = () => {
  return useSWRWithConfig<Project[]>('/api/projects')
}

// Books hooks
export const useBooks = () => {
  return useSWRWithConfig<Book[]>('/api/books')
}

// Gratitudes hooks
export const useGratitudes = () => {
  return useSWRWithConfig<Gratitude[]>('/api/gratitudes')
}

// Clients hooks
export const useClients = () => {
  return useSWRWithConfig<Client[]>('/api/clients')
}

// Subjects hooks
export const useSubjects = () => {
  return useSWRWithConfig<Subject[]>('/api/subjects')
}

// Activity History hooks
export const useActivityHistory = () => {
  return useSWRWithConfig<ActivityHistory[]>('/api/activity-history')
}

// Analytics hooks
export const useAnalytics = () => {
  return useSWRWithConfig<AnalyticsData>('/api/analytics')
}

// School hooks
export const useSchool = () => {
  return useSWRWithConfig<SchoolSubject[]>('/api/school')
}

// Tasks hooks
export const useTasks = () => {
  return useSWRWithConfig<Task[]>('/api/tasks')
}

// Trackers hooks
export const useTrackers = () => {
  return useSWRWithConfig<Tracker[]>('/api/trackers')
}

// Business hooks
export const useBusinessClients = () => {
  return useSWRWithConfig<any[]>('/api/business?type=clients')
}

export const useBusinessContent = () => {
  return useSWRWithConfig<any[]>('/api/business?type=content')
}

// Daily tasks hook (integrated from DataIntegrator)
export const useDailyTasks = () => {
  return useSWRWithConfig<IntegratedTask[]>('/api/daily-tasks')
}

// Calendar events hook (integrated from DataIntegrator)
export const useCalendarEvents = () => {
  return useSWRWithConfig<CalendarEvent[]>('/api/calendar-events')
}