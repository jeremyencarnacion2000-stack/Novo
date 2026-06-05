"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { Task } from "@/types/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Calendar, Trash2, Edit2, AlertCircle, ChevronRight } from "lucide-react"
import { TaskDialog } from "./task-dialog"
import { format, parseISO, isPast, isToday, differenceInDays } from "date-fns"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { DataIntegrator } from "@/lib/data-integrator"
import { TiltCard } from "@/components/ui/tilt-card"
import { cn } from "@/lib/utils"
import { NovoSkeleton } from "@/components/ui/NovoSkeleton"
import { NovoEmptyState } from "@/components/ui/NovoEmptyState"
import { AnimatePresence, motion } from "framer-motion"

const columns: { status: Task["status"]; title: string; color: string }[] = [
  { status: "todo", title: "Not Started", color: "text-muted-foreground" },
  { status: "in-progress", title: "In Progress", color: "text-accent-foreground" },
  { status: "done", title: "Completed", color: "text-primary" },
]

export function TasksView() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadTasks = async () => {
    if (!session?.user?.id) return
    setIsLoading(true)
    try {
      const tasksData = await DataIntegrator.getTasks(session.user.id)
      const tasksArray = Array.isArray(tasksData) ? tasksData : []
      const parsedTasks = tasksArray.map(task => ({
        ...task,
        tags: Array.isArray(task.tags)
          ? task.tags
          : typeof task.tags === 'string'
            ? (task.tags ? JSON.parse(task.tags) : [])
            : []
      }))
      setTasks(parsedTasks)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      loadTasks()

      const handleVoiceCommand = (e: any) => {
        const action = e.detail?.action || e.detail?.result?.action
        if (
          action === "create_task" ||
          action === "update_task" ||
          action === "delete_task" ||
          action === "defer_task" ||
          action === "move_task_to_peak"
        ) {
          loadTasks()
        }
      }

      window.addEventListener("voice-command-executed", handleVoiceCommand)
      return () => {
        window.removeEventListener("voice-command-executed", handleVoiceCommand)
      }
    }
  }, [session?.user?.id])

  const handleCreate = async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!session?.user?.id) return
    try {
      const newTask = await DataIntegrator.createTask(session.user.id, taskData)
      const parsedTask = {
        ...newTask,
        tags: typeof newTask.tags === 'string' ? JSON.parse(newTask.tags) : newTask.tags
      }
      setTasks([...tasks, parsedTask as Task])
      toast.success("Task created")
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error("Failed to create task")
    }
  }

  const handleUpdate = async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!editingTask || !session?.user?.id) return
    try {
      await DataIntegrator.updateTask(session.user.id, editingTask.id, taskData)

      // Optimistic update in UI
      const updatedTask = { ...editingTask, ...taskData }
      const parsedTask = {
        ...updatedTask,
        tags: typeof updatedTask.tags === 'string' ? JSON.parse(updatedTask.tags) : updatedTask.tags
      }
      const updatedTasks = tasks.map((t) => (t.id === editingTask.id ? parsedTask : t))
      setTasks(updatedTasks as Task[])
      setEditingTask(undefined)
      toast.success("Task updated")
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error("Failed to update task")
    }
  }

  const handleDelete = async (id: string) => {
    if (!session?.user?.id) return
    try {
      await DataIntegrator.deleteTask(session.user.id, id)
      setTasks(tasks.filter((t) => t.id !== id))
      toast.success("Task deleted")
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast.error("Failed to delete task")
    }
  }

  const handleStatusChange = async (id: string, status: Task["status"]) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        const updatedTask = await res.json()
        const updatedTasks = tasks.map((t) => (t.id === id ? updatedTask : t))
        setTasks(updatedTasks)
      }
    } catch (error) {
      console.error('Failed to update task status:', error)
    }
  }

  const getNextStatus = (currentStatus: Task["status"]): Task["status"] | null => {
    if (currentStatus === "todo") return "in-progress"
    if (currentStatus === "in-progress") return "done"
    return null
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id)
    setDraggedId(id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, status: Task["status"]) => {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain")
    if (id) {
      handleStatusChange(id, status)
    }
    setDraggedId(null)
  }

  const filteredTasks = tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "secondary"
    }
  }

  const getDaysRemaining = (dateStr: string) => {
    const date = parseISO(dateStr)
    if (isPast(date) && !isToday(date)) return null
    const days = differenceInDays(date, new Date())
    return days
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {columns.map((column) => {
          const columnTasks = filteredTasks.filter((t) => t.status === column.status)

          return (
            <div
              key={column.status}
              className="flex flex-col gap-4"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              <div className={cn("glass-header border-none bg-white/[0.03] rounded-2xl mb-2", column.color)}>
                <div className="flex items-center justify-between px-3">
                  <h3 className="subtitle-technical px-0">{column.title}</h3>
                  <Badge variant="secondary" className="bg-white/5 border-none opacity-50 px-2 h-5 text-[9px] font-black">{columnTasks.length}</Badge>
                </div>
              </div>

              <div
                className={`space-y-3 min-h-[260px] relative rounded-lg transition-colors ${draggedId ? "bg-secondary/10 border-2 border-dashed border-secondary/20" : ""
                  }`}
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="skeleton-container"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <NovoSkeleton variant="card" />
                      <NovoSkeleton variant="card" />
                    </motion.div>
                  ) : columnTasks.length > 0 ? (
                    <motion.div
                      key="tasks-container"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {columnTasks.map((task) => {
                        const nextStatus = getNextStatus(task.status)
                        const isOverdue =
                          task.dueDate &&
                          task.status !== "done" &&
                          isPast(parseISO(task.dueDate)) &&
                          !isToday(parseISO(task.dueDate))

                        return (
                          <TiltCard
                            key={task.id}
                            className={`transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-grab active:cursor-grabbing ${draggedId === task.id ? "opacity-30" : ""
                              }`}
                            draggable
                            onDragStart={(e: any) => handleDragStart(e, task.id)}
                          >
                            <Card className="h-full border-white/5 transition-all duration-500 hover:border-white/10">
                              <CardContent className="p-5 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                  <span
                                    className={cn(
                                      "text-[14px] font-semibold leading-snug tracking-tight opacity-90",
                                      task.status === "done" && "line-through opacity-40"
                                    )}
                                  >
                                    {task.title}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="shrink-0 text-[9px] font-black tracking-wider bg-white/5 border-none opacity-40 hover:opacity-100 transition-opacity uppercase h-5 px-1.5"
                                  >
                                    {task.priority}
                                  </Badge>
                                </div>

                                {Array.isArray(task.tags) && task.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {task.tags.map((tag) => (
                                      <Badge key={tag} variant="outline" className="text-[10px] px-1 h-5">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-xs">
                                  {task.dueDate && (
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                          {format(parseISO(task.dueDate), "MMM d")}
                                        </span>
                                      </div>
                                      {!isOverdue && task.status !== "done" && (
                                        <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                                          {getDaysRemaining(task.dueDate) === 0
                                            ? "Due today"
                                            : `${getDaysRemaining(task.dueDate)} days left`}
                                        </span>
                                      )}
                                      {isOverdue && <AlertCircle className="h-3 w-3 text-destructive" />}
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-2 pt-1">
                                  {nextStatus && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 h-7 text-xs bg-transparent"
                                      onClick={() => handleStatusChange(task.id, nextStatus)}
                                    >
                                      Move
                                      <ChevronRight className="h-3 w-3 ml-1" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setEditingTask(task)
                                      setDialogOpen(true)
                                    }}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(task.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </TiltCard>
                        )
                      })}
                    </motion.div>
                  ) : (
                    <NovoEmptyState
                      key="empty-container"
                      message="Your cognitive slate is clean. Enjoy the open space or command a macro-focus block."
                      actionLabel="Breathe"
                      onAction={() => window.dispatchEvent(new CustomEvent('cognitive:start-breathing'))}
                      className="py-10 min-h-[260px] w-full"
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )
        })}
      </div>

      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditingTask(undefined)
        }}
        onSave={editingTask ? handleUpdate : handleCreate}
        task={editingTask}
      />
    </div>
  )
}
