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

const columns: { status: Task["status"]; title: string; color: string }[] = [
  { status: "todo", title: "Not Started", color: "bg-secondary text-secondary-foreground" },
  { status: "in-progress", title: "In Progress", color: "bg-accent text-accent-foreground" },
  { status: "done", title: "Completed", color: "bg-primary/10 text-primary" },
]

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("novo_standalone_tasks")
    if (stored) {
      setTasks(JSON.parse(stored))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("novo_standalone_tasks", JSON.stringify(tasks))
  }, [tasks])

  const handleCreate = (taskData: Omit<Task, "id" | "createdAt">) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    setTasks([...tasks, newTask])
    toast.success("Task created")
  }

  const handleUpdate = (taskData: Omit<Task, "id" | "createdAt">) => {
    if (!editingTask) return
    const updatedTasks = tasks.map((t) => (t.id === editingTask.id ? { ...t, ...taskData } : t))
    setTasks(updatedTasks)
    setEditingTask(undefined)
    toast.success("Task updated")
  }

  const handleDelete = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id))
    toast.success("Task deleted")
  }

  const handleStatusChange = (id: string, status: Task["status"]) => {
    const updatedTasks = tasks.map((t) => (t.id === id ? { ...t, status } : t))
    setTasks(updatedTasks)
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
              <div className={`rounded-lg border p-4 ${column.color} transition-all hover:shadow-sm`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{column.title}</h3>
                  <Badge variant="outline">{columnTasks.length}</Badge>
                </div>
              </div>

              <div
                className={`space-y-3 min-h-[200px] rounded-lg transition-colors ${
                  draggedId ? "bg-secondary/10 border-2 border-dashed border-secondary/20" : ""
                }`}
              >
                {columnTasks.map((task) => {
                  const nextStatus = getNextStatus(task.status)
                  const isOverdue =
                    task.dueDate &&
                    task.status !== "done" &&
                    isPast(parseISO(task.dueDate)) &&
                    !isToday(parseISO(task.dueDate))

                  return (
                    <Card
                      key={task.id}
                      className={`transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${
                        draggedId === task.id ? "opacity-50" : ""
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`font-medium leading-tight ${
                              task.status === "done" ? "line-through text-muted-foreground" : ""
                            }`}
                          >
                            {task.title}
                          </span>
                          <Badge
                            variant={getPriorityColor(task.priority) as any}
                            className="shrink-0 text-[10px] h-5 px-1.5 capitalize"
                          >
                            {task.priority}
                          </Badge>
                        </div>

                        {task.tags.length > 0 && (
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
                  )
                })}

                {columnTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg opacity-50">
                    <p className="text-xs text-muted-foreground">No tasks</p>
                  </div>
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
