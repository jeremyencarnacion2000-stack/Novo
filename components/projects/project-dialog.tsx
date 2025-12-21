"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Project, ProjectStatus, Subtask } from "@/types/project"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

interface ProjectDialogProps {
  open: boolean
  onClose: () => void
  onSave: (project: Project | Omit<Project, "id">) => void
  project?: Project
}

export function ProjectDialog({ open, onClose, onSave, project }: ProjectDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("not-started")
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium")
  const [startDate, setStartDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [progress, setProgress] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [subtaskInput, setSubtaskInput] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (project) {
      setTitle(project.title)
      setDescription(project.description)
      setStatus(project.status)
      setPriority(project.priority)
      setStartDate(project.startDate)
      setDueDate(project.dueDate)
      setProgress(project.progress)
      setTags(typeof project.tags === 'string' ? JSON.parse(project.tags) : (Array.isArray(project.tags) ? project.tags : []))
      setSubtasks(project.subtasks)
      setNotes(project.notes)
    } else {
      setTitle("")
      setDescription("")
      setStatus("not-started")
      setPriority("medium")
      setStartDate("")
      setDueDate("")
      setProgress(0)
      setTags([])
      setSubtasks([])
      setNotes("")
    }
  }, [project, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const projectData = {
      title,
      description,
      status,
      priority,
      startDate,
      dueDate,
      progress,
      tags,
      subtasks,
      notes,
    }

    if (project) {
      onSave({ ...projectData, id: project.id })
    } else {
      onSave(projectData)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput("")
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const addSubtask = () => {
    if (subtaskInput.trim()) {
      setSubtasks([...subtasks, { id: Date.now().toString(), title: subtaskInput.trim(), completed: false }])
      setSubtaskInput("")
    }
  }

  const toggleSubtask = (id: string) => {
    setSubtasks(subtasks.map((st) => (st.id === id ? { ...st, completed: !st.completed } : st)))
  }

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{project ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription>
              {project ? "Update your project details" : "Add a new project with all the details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Website Redesign"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project"
                rows={3}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value: ProjectStatus) => setStatus(value)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-started">Not Started</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="progress">Progress (%)</Label>
                <Input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a tag"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
                <Button type="button" onClick={addTag} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtasks">Tasks</Label>
              <div className="flex gap-2">
                <Input
                  id="subtasks"
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  placeholder="Add a task"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addSubtask()
                    }
                  }}
                />
                <Button type="button" onClick={addSubtask} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {subtasks.length > 0 && (
                <div className="space-y-2 mt-3">
                  {subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                      <Checkbox checked={subtask.completed} onCheckedChange={() => toggleSubtask(subtask.id)} />
                      <span
                        className={`flex-1 text-sm ${subtask.completed ? "line-through text-muted-foreground" : ""}`}
                      >
                        {subtask.title}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSubtask(subtask.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or details..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{project ? "Update" : "Create"} Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
