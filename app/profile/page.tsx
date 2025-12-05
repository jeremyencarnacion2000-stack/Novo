'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Target,
  Trophy,
  Flame,
  Clock,
  CheckSquare,
  Briefcase,
  Plus,
  Trash2,
  Calendar,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Goal {
  id: string;
  title: string;
  description?: string;
  category?: string;
  progress: number;
  targetDate?: string;
  status: string;
}

interface ProfileData {
  profile: {
    id: string;
    name: string;
    email: string;
    image?: string;
    daysSinceMember: number;
  };
  stats: {
    tasksCompleted: number;
    projectsCreated: number;
    focusHours: number;
    habitsTracked: number;
    currentStreak: number;
  };
  goals: Goal[];
}

const categoryColors: Record<string, string> = {
  career: 'bg-blue-500',
  health: 'bg-green-500',
  finance: 'bg-yellow-500',
  personal: 'bg-purple-500',
  education: 'bg-orange-500',
  relationships: 'bg-pink-500',
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'personal',
    targetDate: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoal.title.trim()) return;
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoal),
      });
      if (response.ok) {
        toast({ title: 'Goal created!' });
        setNewGoal({ title: '', description: '', category: 'personal', targetDate: '' });
        setGoalDialogOpen(false);
        fetchProfile();
      }
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await fetch(`/api/goals/${id}`, { method: 'DELETE' });
      fetchProfile();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateProgress = async (id: string, progress: number) => {
    try {
      await fetch(`/api/goals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress }),
      });
      fetchProfile();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardShell>
    );
  }

  const profile = profileData?.profile;
  const stats = profileData?.stats || { tasksCompleted: 0, projectsCreated: 0, focusHours: 0, habitsTracked: 0, currentStreak: 0 };
  const goals = profileData?.goals || [];

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile?.image || session?.user?.image || ''} />
                <AvatarFallback className="text-2xl">
                  {profile?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="text-center md:text-left">
                <h1 className="text-2xl font-bold">{profile?.name || 'User'}</h1>
                <p className="text-muted-foreground">{profile?.email}</p>
                <Badge variant="secondary" className="mt-2">
                  Member for {profile?.daysSinceMember || 0} days
                </Badge>
              </div>
              <div className="flex-1" />
              <div className="text-center">
                <Flame className="h-8 w-8 mx-auto text-orange-500" />
                <p className="text-2xl font-bold">{stats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <CheckSquare className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.tasksCompleted}</p>
                <p className="text-sm text-muted-foreground">Tasks Done</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.projectsCreated}</p>
                <p className="text-sm text-muted-foreground">Projects</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.focusHours}h</p>
                <p className="text-sm text-muted-foreground">Focus Time</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.habitsTracked}</p>
                <p className="text-sm text-muted-foreground">Habits</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Goals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Global Goals
                </CardTitle>
                <CardDescription>Long-term objectives</CardDescription>
              </div>
              <Button onClick={() => setGoalDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Goal
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No goals yet. Create your first goal!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.map((goal) => (
                  <div key={goal.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{goal.title}</h3>
                          {goal.category && (
                            <Badge className={`${categoryColors[goal.category]} text-white`}>
                              {goal.category}
                            </Badge>
                          )}
                        </div>
                        {goal.description && (
                          <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                        )}
                        {goal.targetDate && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Target: {new Date(goal.targetDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={goal.progress} className="flex-1" />
                      <span className="text-sm font-medium w-12 text-right">{goal.progress}%</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[0, 25, 50, 75, 100].map((p) => (
                        <Button
                          key={p}
                          variant={goal.progress >= p ? 'default' : 'outline'}
                          size="sm"
                          className="text-xs px-2"
                          onClick={() => handleUpdateProgress(goal.id, p)}
                        >
                          {p}%
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goal Dialog */}
        <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
              <DialogDescription>Set a meaningful goal</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Goal Title</Label>
                <Input
                  placeholder="e.g., Learn a new language"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Why is this goal important?"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newGoal.category} onValueChange={(v) => setNewGoal({ ...newGoal, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="career">Career</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="relationships">Relationships</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Date</Label>
                  <Input
                    type="date"
                    value={newGoal.targetDate}
                    onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateGoal}>Create Goal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}