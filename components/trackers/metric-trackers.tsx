import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Edit, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { Tracker } from '@/types/tracker'
import { useState } from 'react'
import { useNotifications } from '@/lib/notification-context'

interface MetricTrackersProps {
  trackers: Tracker[]
  onEdit: (tracker: Tracker) => void
  onDelete: (id: string) => void
  onLogEntry: (id: string, value: number) => void
}

export function MetricTrackers({ trackers, onEdit, onDelete, onLogEntry }: MetricTrackersProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const { showNotification, settings: notificationSettings } = useNotifications()

  const getWeeklyAverage = (tracker: Tracker) => {
    const last7Days: string[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      last7Days.push(date.toISOString().split('T')[0])
    }

    const weekEntries = (Array.isArray(tracker.entries) ? tracker.entries : []).filter((e) =>
      last7Days.includes(e.date)
    )
    if (weekEntries.length === 0) return 0
    return Math.round(
      weekEntries.reduce((sum, e) => sum + e.value, 0) / weekEntries.length
    )
  }

  const getTrend = (tracker: Tracker) => {
    const entries = tracker.entries || []
    if (entries.length < 2) return 'neutral'
    const sorted = [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    const latest = sorted[0].value
    const previous = sorted[1].value
    if (latest > previous) return 'up'
    if (latest < previous) return 'down'
    return 'neutral'
  }

  const handleLog = (trackerId: string) => {
    const value = parseFloat(inputValues[trackerId] || '0')
    if (value > 0) {
      const tracker = trackers.find(t => t.id === trackerId)
      const hadTodayEntry = (Array.isArray(tracker?.entries) ? tracker.entries : []).some(
        (e) => e.date === new Date().toISOString().split('T')[0]
      )

      onLogEntry(trackerId, value)
      setInputValues({ ...inputValues, [trackerId]: '' })

      // Check for goal achievement
      if (tracker && !hadTodayEntry && value >= tracker.goal && notificationSettings.progressAchievements) {
        showNotification('Goal Achieved!', {
          body: `Congratulations! You've reached your ${tracker.name} goal of ${tracker.goal} ${tracker.unit}!`,
          tag: `goal-achievement-${trackerId}`
        })
      }
    }
  }

  if (trackers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            No metric trackers yet. Create one to start measuring progress.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {trackers.map((tracker) => {
        const weeklyAvg = getWeeklyAverage(tracker)
        const trend = getTrend(tracker)
        const todayEntry = (Array.isArray(tracker.entries) ? tracker.entries : []).find(
          (e) => e.date === new Date().toISOString().split('T')[0]
        )

        return (
          <Card variant="primary" key={tracker.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{tracker.name}</CardTitle>
                {trend !== 'neutral' && (
                  <Badge variant={trend === 'up' ? 'default' : 'secondary'}>
                    {trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {trend === 'up' ? 'Trending Up' : 'Trending Down'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Weekly Average</p>
                  <p className="text-2xl font-bold">
                    {weeklyAvg}
                    <span className="text-sm text-muted-foreground ml-1">
                      {tracker.unit}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Goal</p>
                  <p className="text-2xl font-bold">
                    {tracker.goal}
                    <span className="text-sm text-muted-foreground ml-1">
                      {tracker.unit}
                    </span>
                  </p>
                </div>
              </div>

              {todayEntry ? (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">Today&apos;s Entry</p>
                  <p className="text-lg font-semibold">
                    {todayEntry.value} {tracker.unit}
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={`Enter ${tracker.unit}...`}
                    value={inputValues[tracker.id] || ''}
                    onChange={(e) =>
                      setInputValues({
                        ...inputValues,
                        [tracker.id]: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleLog(tracker.id)
                      }
                    }}
                  />
                  <Button onClick={() => handleLog(tracker.id)}>Log</Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(tracker)}
                >
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
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
