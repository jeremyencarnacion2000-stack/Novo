"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Calendar, RefreshCw, Briefcase, GraduationCap, ListChecks, CheckSquare } from "lucide-react"
import type { ChecklistItem } from "@/types/checklist"
import { DataIntegrator, type IntegratedTask } from "@/lib/data-integrator"
import { toast } from "sonner"
import { TiltCard } from "@/components/ui/tilt-card"

export default function ChecklistClient() {
  const { data: session } = useSession()
  const [isClient, setIsClient] = useState(false)
  const [items, setItems] = useState<IntegratedTask[]>([])
  const [newItemText, setNewItemText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load tasks on mount
  useEffect(() => {
    if (session?.user?.id && isClient) {
      loadTasks()
    }
  }, [session?.user?.id, isClient])

  const loadTasks = async () => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      const tasks = await DataIntegrator.getDailyTasks(session.user.id)
      setItems(Array.isArray(tasks) ? tasks : [])
    } catch (error) {
      console.error("Failed to load tasks", error)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  const completedCount = items.filter((item) => item.completed).length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newItemText.trim() && session?.user?.id) {
      try {
        await DataIntegrator.createManualTask(session.user.id, {
          text: newItemText,
          completed: false,
          priority: "medium",
          userId: session.user.id
        })

        setNewItemText("")
        // We reload tasks to potentially get the real ID if online, 
        // or just to ensure consistency.
        loadTasks()
        toast.success("Task added")
      } catch (error) {
        console.error('Error adding task:', error)
        toast.error("Failed to add task")
      }
    }
  }

  const handleToggleComplete = async (task: IntegratedTask) => {
    if (!session?.user?.id) return

    // Optimistic update
    setItems(items.map((i) => (i.id === task.id ? { ...i, completed: !i.completed } : i)))

    // Sync with source
    try {
      await DataIntegrator.toggleTaskCompletion(session.user.id, task)
    } catch (error) {
      // Revert optimistic update on error
      setItems(items.map((i) => (i.id === task.id ? { ...i, completed: !i.completed } : i)))
      console.error("Failed to toggle task completion", error)
    }
  }

  const handleDelete = async (id: string) => {
    // Only manual tasks can be deleted from here for now
    const task = items.find((i) => i.id === id)
    if (task && task.source === "manual" && session?.user?.id) {
      try {
        await DataIntegrator.deleteManualTask(session.user.id, id)
        loadTasks()
        toast.success("Task deleted")
      } catch (error) {
        console.error('Error deleting task:', error)
        toast.error("Failed to delete task")
      }
    } else {
      toast.error("Can't delete integrated tasks here. Manage them in their respective modules.")
    }
  }

  const priorityOrder = { high: 1, medium: 2, low: 3 }
  const sortedItems = [...items].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "routine":
        return <ListChecks className="h-3 w-3" />
      case "project":
        return <Briefcase className="h-3 w-3" />
      case "school":
        return <GraduationCap className="h-3 w-3" />
      case "standalone":
        return <CheckSquare className="h-3 w-3" />
      default:
        return null
    }
  }

  const getSourceLabel = (task: IntegratedTask) => {
    if (task.source === "routine") return task.metadata?.routineName
    if (task.source === "project") return task.metadata?.projectName
    if (task.source === "school") return task.metadata?.subjectName
    if (task.source === "standalone") return "Standalone Task"
    return null
  }

  const getSourceBadge = (source: IntegratedTask["source"], context?: string | null) => {
    switch (source) {
      case "school":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] h-5 px-1.5">
            {context || "School"}
          </Badge>
        )
      case "project":
        return (
          <Badge
            variant="outline"
            className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px] h-5 px-1.5"
          >
            {context || "Project Task"}
          </Badge>
        )
      case "routine":
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[10px] h-5 px-1.5"
          >
            {context || "Routine"}
          </Badge>
        )
      case "standalone":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] h-5 px-1.5"
          >
            {context || "Task"}
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">Daily Checklist</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Your unified view of tasks from all modules
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <Button variant="outline" size="sm" onClick={loadTasks} className="h-8 bg-transparent">
            <RefreshCw className="h-3 w-3 mr-2" />
            Sync
          </Button>
          <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-md">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </span>
            <span className="sm:hidden">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg">Today&apos;s Progress</CardTitle>
            <Badge variant="outline" className="text-xs">
              {completedCount} / {totalCount}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">{progressPercent}% complete</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2 relative">
            <Input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1"
            />
            <Button type="submit">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </form>

          <div className="space-y-2">
            {items.map(item => (
              <TiltCard
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => handleToggleComplete(item)}
                  />
                  <div className="flex flex-col">
                    <span className={item.completed ? 'line-through text-muted-foreground' : ''}>
                      {item.text}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {getSourceBadge(item.source, getSourceLabel(item))}
                    </div>
                  </div>
                </div>
                {item.source === 'manual' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TiltCard>
            ))}
            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tasks yet. Add one above!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}