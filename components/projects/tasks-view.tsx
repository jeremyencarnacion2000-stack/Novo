"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
import { cn } from "@/lib/utils"
import { NovoSkeleton } from "@/components/ui/NovoSkeleton"
import { NovoEmptyState } from "@/components/ui/NovoEmptyState"
import { eventBus } from "@/lib/events/event-bus"
import { createSwapy } from "swapy"

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
  const [isLoading, setIsLoading] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const swapyRef = useRef<any>(null)

  // Keep refs to latest values so Swapy callbacks (closed-over once) are always fresh
  const tasksRef = useRef(tasks)
  const handleStatusChangeRef = useRef<(id: string, status: Task["status"]) => void>(() => {})
  // Slot registry: taskId → current status
  const slotRegistryRef = useRef<Map<string, Task["status"]>>(new Map())

  // Sync refs every render
  useEffect(() => {
    tasksRef.current = tasks
    // Rebuild slot registry on every task list change
    const map = new Map<string, Task["status"]>()
    for (const t of tasks) {
      map.set(t.id, t.status)
    }
    slotRegistryRef.current = map
  })

  // Keep handleStatusChangeRef up to date
  useEffect(() => {
    handleStatusChangeRef.current = handleStatusChange
  })

  const handleEditClick = (task: Task) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

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
      setTasks(prev => [...prev, parsedTask as Task])
      toast.success("Task created")
      eventBus.dispatch("TaskCreated", {
        taskId: parsedTask.id,
        taskTitle: parsedTask.title,
        priority: parsedTask.priority,
      })
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error("Failed to create task")
    }
  }

  const handleUpdate = async (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!editingTask || !session?.user?.id) return
    try {
      await DataIntegrator.updateTask(session.user.id, editingTask.id, taskData)

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
    // Optimistic update so React re-renders instantly into the new column
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        const updatedTask = await res.json()
        setTasks(prev => prev.map(t => t.id === id ? {
          ...updatedTask,
          tags: typeof updatedTask.tags === 'string' ? JSON.parse(updatedTask.tags) : updatedTask.tags
        } : t))
        if (status === 'done') {
          const task = tasksRef.current.find(t => t.id === id)
          eventBus.dispatch("TaskCompleted", { taskId: id, taskTitle: task?.title ?? '', priority: task?.priority ?? 'medium' })
        }
      }
    } catch (error) {
      console.error('Failed to update task status:', error)
      loadTasks() // Rollback on error
    }
  }

  const getNextStatus = (currentStatus: Task["status"]): Task["status"] | null => {
    if (currentStatus === "todo") return "in-progress"
    if (currentStatus === "in-progress") return "done"
    return null
  }

  // ── Swapy init (once, after loading completes) ───────────────────────────────
  useEffect(() => {
    if (isLoading || !containerRef.current) return

    swapyRef.current = createSwapy(containerRef.current, {
      manualSwap: true,
      animation: "dynamic",
    })

    swapyRef.current.onSwap(({ newSlotItemMap }: any) => {
      const entries = Object.entries(newSlotItemMap.asObject) as [string, string | null][]
      // Resolve every entry against a frozen snapshot of the registry FIRST —
      // a swap between two columns produces two entries in the same event,
      // and mutating the (shared) registry while still reading it mid-loop
      // meant the second entry's lookup could read the first entry's write,
      // sending one of the two tasks to the wrong column.
      const snapshot = new Map(slotRegistryRef.current)
      const moves: Array<{ itemId: string; newStatus: Task["status"] }> = []
      for (const [slotId, itemId] of entries) {
        if (!itemId) continue
        // Resolve which column this slot belongs to.
        // Empty drop-zone slots: "empty-todo", "empty-in-progress", "empty-done"
        // Task slots: the task's own ID
        let newStatus: Task["status"] | null = null
        if (slotId.startsWith("empty-")) {
          newStatus = slotId.replace("empty-", "") as Task["status"]
        } else {
          // Regular slot: same ID as task that currently lives there.
          // Walk the registry to find which column owns this slot.
          newStatus = snapshot.get(slotId) ?? null
        }
        if (!newStatus) continue
        const currentStatus = snapshot.get(itemId)
        if (currentStatus && currentStatus !== newStatus) {
          moves.push({ itemId, newStatus })
        }
      }
      for (const { itemId, newStatus } of moves) {
        // Optimistic registry update to prevent duplicate fire
        slotRegistryRef.current.set(itemId, newStatus)
        handleStatusChangeRef.current(itemId, newStatus)
      }
    })

    return () => {
      swapyRef.current?.destroy()
      swapyRef.current = null
    }
  }, [isLoading]) // re-init only when loading state changes (once: false→true)

  // ── Notify Swapy when DOM changes (tasks added, removed, or reordered) ───────
  useEffect(() => {
    if (!isLoading) {
      swapyRef.current?.update()
    }
  }, [tasks, isLoading])

  // Search filtering only affects visibility — we keep all tasks in the DOM with
  // data-swapy-no-drag so the slot/item structure never breaks when search changes.
  // Slots are always indexed by task ID, not position.
  const filteredTaskIds = useMemo(() => {
    if (!search.trim()) return null // null = show all
    return new Set(tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase())).map(t => t.id))
  }, [tasks, search])

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
        <Button onClick={() => setDialogOpen(true)} data-flip-from="btn-new-task" className="w-full sm:w-auto">
          <Plus data-shared-item="icon" className="h-4 w-4 mr-2" />
          <span data-shared-item="text">New Task</span>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3" ref={containerRef}>
        {columns.map((column) => {
          // All tasks for this column — we render ALL of them in the DOM so Swapy
          // slot IDs remain stable. Tasks filtered out by search are hidden via CSS.
          const columnTasks = tasks.filter((t) => t.status === column.status)

          return (
            <div
              key={column.status}
              className="flex flex-col gap-4"
            >
              <div className={cn("glass-header border-none bg-foreground/[0.03] rounded-[20px] mb-2", column.color)}>
                <div className="flex items-center justify-between px-3">
                  <h3 className="subtitle-technical px-0">{column.title}</h3>
                  {/* Count only visible (non-filtered) tasks */}
                  <Badge variant="secondary" className="bg-foreground/5 border-none opacity-50 px-2 h-5 text-[9px] font-black">
                    {filteredTaskIds ? columnTasks.filter(t => filteredTaskIds.has(t.id)).length : columnTasks.length}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 min-h-[260px] relative rounded-lg transition-colors">
                {isLoading ? (
                  <div className="space-y-3">
                    <NovoSkeleton variant="card" />
                    <NovoSkeleton variant="card" />
                  </div>
                ) : columnTasks.length === 0 && !filteredTaskIds ? (
                  // True empty state (no tasks in this column at all)
                  <div data-swapy-slot={`empty-${column.status}`} className="h-full min-h-[200px]">
                    <NovoEmptyState
                      message="Drop tasks here or create one."
                      actionLabel="Breathe"
                      onAction={() => window.dispatchEvent(new CustomEvent('cognitive:start-breathing'))}
                      className="py-10 min-h-[200px] w-full"
                    />
                  </div>
                ) : (
                  <>
                    {columnTasks.map((task) => {
                      const nextStatus = getNextStatus(task.status)
                      const isOverdue =
                        task.dueDate &&
                        task.status !== "done" &&
                        isPast(parseISO(task.dueDate)) &&
                        !isToday(parseISO(task.dueDate))

                      const isHidden = filteredTaskIds ? !filteredTaskIds.has(task.id) : false

                      return (
                        // Slot ID = task ID (stable, unique) — never an array index
                        <div
                          key={task.id}
                          data-swapy-slot={task.id}
                          className={cn("w-full", isHidden && "hidden")}
                        >
                          <div data-swapy-item={task.id} className="w-full">
                            <Card data-flip-from={`task-${task.id}`} className="h-full border-foreground/5 transition-all duration-500 hover:border-foreground/10 hover-glow-border">
                                <CardContent className="p-5 space-y-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <span data-shared-item="text" className={cn("text-[14px] font-semibold leading-snug tracking-tight opacity-90", task.status === "done" && "line-through opacity-40")}>
                                      {task.title}
                                    </span>
                                    <Badge variant="secondary" className="shrink-0 text-[9px] font-black tracking-wider bg-foreground/5 border-none opacity-40 hover:opacity-100 transition-opacity uppercase h-5 px-1.5">
                                      {task.priority}
                                    </Badge>
                                  </div>

                                  {Array.isArray(task.tags) && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {task.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-[10px] px-1 h-5">{tag}</Badge>
                                      ))}
                                    </div>
                                  )}

                                  {task.dueDate && (
                                    <div className="flex items-center gap-2 text-xs">
                                      <Calendar className="h-3 w-3 text-muted-foreground" />
                                      <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                        {format(parseISO(task.dueDate), "MMM d")}
                                      </span>
                                      {!isOverdue && task.status !== "done" && (
                                        <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                                          {getDaysRemaining(task.dueDate) === 0 ? "Due today" : `${getDaysRemaining(task.dueDate)} days left`}
                                        </span>
                                      )}
                                      {isOverdue && <AlertCircle className="h-3 w-3 text-destructive" />}
                                    </div>
                                  )}

                                  <div className="flex gap-2 pt-1">
                                    {nextStatus && (
                                      <Button variant="outline" size="sm" className="flex-1 h-7 text-xs bg-transparent" onClick={() => handleStatusChange(task.id, nextStatus)}>
                                        Move <ChevronRight className="h-3 w-3 ml-1" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClick(task)}>
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(task.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </CardContent>
                            </Card>
                          </div>
                        </div>
                      )
                    })}

                    {/* Permanent drop zone — always present in this column */}
                    <div
                      data-swapy-slot={`empty-${column.status}`}
                      className="h-10 w-full flex items-center justify-center border border-dashed border-foreground/[0.04] rounded-2xl text-[10px] text-foreground/20 hover:text-foreground/40 hover:border-foreground/10 hover:bg-foreground/[0.01] transition-all duration-300"
                    >
                      Drop here
                    </div>
                  </>
                )}
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
