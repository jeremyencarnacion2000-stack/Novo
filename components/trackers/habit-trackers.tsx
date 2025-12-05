import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { Tracker } from '@/types/tracker'
import { useNotifications } from '@/lib/notification-context'
import { useNotificationScheduler } from '@/lib/notification-scheduler'

interface HabitTrackersProps {
  trackers: Tracker[]
  onEdit: (tracker: Tracker) => void
  onDelete: (id: string) => void
  onLogEntry: (id: string, value: number) => void
}

export function HabitTrackers({ trackers, onEdit, onDelete, onLogEntry }: HabitTrackersProps) {
  const { showNotification, settings: notificationSettings } = useNotifications()
  const { scheduleProgressAchievement } = useNotificationScheduler()

  const getLast7Days = () => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push(date.toISOString().split('T')[0])
    }
    return days
  }

  const last7Days = getLast7Days()

  const handleLogEntry = (trackerId: string, value: number) => {
    const tracker = trackers.find(t => t.id === trackerId)
    if (!tracker) return

    const wasCompletedToday = (Array.isArray(tracker.entries) ? tracker.entries : []).some(
      (e) => e.date === new Date().toISOString().split('T')[0]
    )

    // Log the entry
    onLogEntry(trackerId, value)

    // Check for achievements if this is a new completion
    if (value === 1 && !wasCompletedToday && notificationSettings.progressAchievements) {
      const progress = getWeeklyProgress(tracker)
      const newProgress = { completed: progress.completed + 1, total: progress.total }

      // Check for streak milestones
      if (newProgress.completed === 7) {
        showNotification('Habit Streak!', {
          body: `Congratulations! You've completed ${tracker.name} for 7 days straight!`,
          tag: `habit-streak-${trackerId}`
        })
      } else if (newProgress.completed === 3) {
        showNotification('Habit Milestone!', {
          body: `Great job! You've completed ${tracker.name} for 3 days this week.`,
          tag: `habit-milestone-${trackerId}`
        })
      }
    }
  }

  const getWeeklyProgress = (tracker: Tracker) => {
    const completed = (Array.isArray(tracker.entries) ? tracker.entries : []).filter((e) =>
      last7Days.includes(e.date)
    ).length
    return { completed, total: 7 }
  }

  if (trackers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            No habit trackers yet. Create one to start building consistency.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {trackers.map((tracker) => {
        const progress = getWeeklyProgress(tracker)
        const todayEntry = (Array.isArray(tracker.entries) ? tracker.entries : []).find(
          (e) => e.date === new Date().toISOString().split('T')[0]
        )

        return (
          <Card key={tracker.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{tracker.name}</CardTitle>
                <Badge variant="outline">
                  {progress.completed}/{progress.total} this week
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-1">
                {last7Days.map((date) => {
                  const hasEntry = (Array.isArray(tracker.entries) ? tracker.entries : []).some((e) => e.date === date)
                  const isToday = date === new Date().toISOString().split('T')[0]
                  
                  return (
                    <div
                      key={date}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className={`w-full aspect-square rounded-md flex items-center justify-center ${
                          hasEntry
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        } ${isToday ? 'ring-2 ring-ring' : ''}`}
                      >
                        {hasEntry && <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  variant={todayEntry ? 'secondary' : 'default'}
                  size="sm"
                  className="flex-1"
                  onClick={() => handleLogEntry(tracker.id, todayEntry ? 0 : 1)}
                >
                  {todayEntry ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-2" />
                      Completed Today
                    </>
                  ) : (
                    <>
                      <Circle className="h-3 w-3 mr-2" />
                      Mark Complete
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(tracker)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(tracker.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
