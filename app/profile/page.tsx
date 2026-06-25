'use client'

import { useState, useEffect } from 'react'
import { GoalsManager } from '@/components/profile/goals-manager'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useSession, signOut } from 'next-auth/react'
import { User, Target, Sparkles, Edit2, Save, X, CalendarDays, CheckCircle2, Flame, Trophy, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [bio, setBio] = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [tempBio, setTempBio] = useState('')
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    focusHours: 0,
    currentStreak: 0,
    goalsAchieved: 0,
  })

  useEffect(() => {
    // Fetch user settings for bio
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/user-settings')
        if (response.ok) {
          const data = await response.json()
          setBio(data.preferences?.bio || '')
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      }
    }

    // Fetch stats from profile API (includes streak calculation)
    const fetchStats = async () => {
      try {
        const [profileRes, goalsRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/goals'),
        ])

        if (profileRes.ok) {
          const data = await profileRes.json()
          setStats(prev => ({
            ...prev,
            tasksCompleted: data.stats?.tasksCompleted || 0,
            currentStreak: data.stats?.currentStreak || 0,
            focusHours: data.stats?.focusHours || 0,
          }))
        }

        if (goalsRes.ok) {
          const goals = await goalsRes.json()
          const achieved = Array.isArray(goals) ? goals.filter((g: any) => g.status === 'completed').length : 0
          setStats(prev => ({ ...prev, goalsAchieved: achieved }))
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchUserData()
    fetchStats()
  }, [])

  const handleSaveBio = async () => {
    try {
      const response = await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { bio: tempBio } }),
      })

      if (response.ok) {
        setBio(tempBio)
        setEditingBio(false)
        toast({ title: 'Bio updated' })
      }
    } catch (error) {
      toast({ title: 'Failed to update bio', variant: 'destructive' })
    }
  }

  const startEditBio = () => {
    setTempBio(bio)
    setEditingBio(true)
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Profile & Goals</h2>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* User Info & Stats */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile Card */}
          <Card className="liquid-glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || 'User'} />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-2xl font-bold text-white">
                    {session?.user?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{session?.user?.name}</h3>
                  <p className="text-muted-foreground text-sm">{session?.user?.email}</p>
                  <Badge variant="secondary" className="mt-2">
                    <CalendarDays className="h-3 w-3 mr-1" />
                    Member since 2024
                  </Badge>
                </div>
              </div>

              {/* Bio Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Bio</span>
                  {!editingBio && (
                    <Button variant="ghost" size="sm" onClick={startEditBio}>
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                {editingBio ? (
                  <div className="space-y-2">
                    <Textarea
                      value={tempBio}
                      onChange={(e) => setTempBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveBio}>
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingBio(false)}>
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {bio || 'No bio yet. Click edit to add one!'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="liquid-glass bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{stats.tasksCompleted}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tasks Completed</p>
              </CardContent>
            </Card>

            <Card className="liquid-glass bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span className="text-2xl font-bold">{stats.currentStreak}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Day Streak</p>
              </CardContent>
            </Card>

            <Card className="liquid-glass bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-500" />
                  <span className="text-2xl font-bold">{stats.focusHours}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Focus Hours</p>
              </CardContent>
            </Card>

            <Card className="liquid-glass bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span className="text-2xl font-bold">{stats.goalsAchieved}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Goals Achieved</p>
              </CardContent>
            </Card>
          </div>

          {/* Vision Board Placeholder */}
          <Card className="liquid-glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Vision Board
              </CardTitle>
              <CardDescription>
                Visualize your dreams and aspirations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg text-muted-foreground bg-muted/50">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Coming Soon</p>
                  <p className="text-xs mt-1">Upload images that inspire you</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Goals Manager */}
        <div className="lg:col-span-4">
          <GoalsManager />
        </div>
      </div>
    </div>
  )
}
