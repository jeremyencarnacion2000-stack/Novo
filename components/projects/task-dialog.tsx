"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Task } from "@/types/project"
import { useNotifications } from "@/lib/notification-context"
import { useModalFlip } from "@/hooks/use-modal-flip"

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  onSave: (task: Omit<Task, "id" | "createdAt">) => void
  task?: Task
}

export function TaskDialog({ open, onClose, onSave, task }: TaskDialogProps) {
  const { showNotification, settings: notificationSettings } = useNotifications()
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<Task["status"]>("todo")
  const [priority, setPriority] = useState<Task["priority"]>("medium")
  const [dueDate, setDueDate] = useState("")

  const flipKey = task ? `task-${task.id}` : 'btn-new-task'
  const closeFlip = useModalFlip(flipKey, open)
  const handleClose = () => closeFlip(onClose)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setStatus(task.status)
      setPriority(task.priority)
      setDueDate(task.dueDate || "")
    } else {
      setTitle("")
      setStatus("todo")
      setPriority("medium")
      setDueDate("")
    }
  }, [task, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const isNewTask = !task

    onSave({
      title,
      status,
      priority,
      dueDate: dueDate || undefined,
      tags: [],
      projectId: undefined,
    })

    // Show notification for new task creation
    if (isNewTask && notificationSettings.taskNotifications) {
      showNotification('New Task Added', {
        body: `"${title}" has been added to your task list`,
        tag: 'new-task'
      })
    }

    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent data-flip-to={flipKey} className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!task && <Plus data-shared-item="icon" className="h-5 w-5" />}
            <span data-shared-item="text">{task ? "Edit Task" : "New Task"}</span>
          </DialogTitle>
          <DialogDescription>
            {task ? "Update task details" : "Create a new task"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (Optional)</Label>
            <Input type="date" id="dueDate" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">Save Task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
