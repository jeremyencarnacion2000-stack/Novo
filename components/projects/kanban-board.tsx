"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Calendar, ChevronRight, AlertCircle, CheckCircle2, GripVertical } from "lucide-react"
import type { Project, ProjectStatus } from "@/types/project"
import { Progress } from "@/components/ui/progress"
import { useState, useEffect, useRef } from "react"
import { TiltCard } from "@/components/ui/tilt-card"
import { cn } from "@/lib/utils"
import { createSwapy } from "swapy"
import { blendy } from "@/lib/blendy"

interface KanbanBoardProps {
  projects: Project[]
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: ProjectStatus) => void
}

const columns: { status: ProjectStatus; title: string; color: string }[] = [
  { status: "not-started", title: "Not Started", color: "text-muted-foreground" },
  { status: "in-progress", title: "In Progress", color: "text-accent-foreground" },
  { status: "completed", title: "Completed", color: "text-primary" },
]

export function KanbanBoard({ projects, onEdit, onDelete, onStatusChange }: KanbanBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const swapyRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    swapyRef.current = createSwapy(containerRef.current, {
      manualSwap: true,
      animation: "dynamic"
    })

    swapyRef.current.onSwapEnd(({ data }: any) => {
      Object.entries(data.object).forEach(([slotId, itemId]) => {
        if (itemId) {
          const status = slotId.split("-").slice(0, -1).join("-") as ProjectStatus
          const proj = projects.find(p => p.id === itemId)
          if (proj && proj.status !== status) {
            onStatusChange(itemId as string, status)
          }
        }
      })
    })

    return () => {
      swapyRef.current?.destroy()
    }
  }, [projects, onStatusChange])

  const getNextStatus = (currentStatus: ProjectStatus): ProjectStatus | null => {
    if (currentStatus === "not-started") return "in-progress"
    if (currentStatus === "in-progress") return "completed"
    return null
  }

  const getDaysRemaining = (dueDate: string): number => {
    const due = new Date(dueDate)
    const today = new Date()
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const handleEditClick = (project: Project) => {
    blendy.toggle(`project-${project.id}`)
    onEdit(project)
  }

  return (
    <div className="grid gap-6 md:grid-cols-3" ref={containerRef}>
      {columns.map((column) => {
        const columnProjects = projects.filter((p) => p.status === column.status)

        return (
          <div
            key={column.status}
            className="flex flex-col gap-4"
          >
            <div className={cn("glass-header border-none bg-white/[0.03] rounded-2xl mb-2", column.color)}>
              <div className="flex items-center justify-between px-3">
                <h3 className="subtitle-technical px-0">{column.title}</h3>
                <Badge variant="secondary" className="bg-white/5 border-none opacity-50 px-2 h-5 text-[9px] font-black">{columnProjects.length}</Badge>
              </div>
            </div>

            <div
              className="space-y-3 min-h-[200px] rounded-lg transition-colors"
            >
              {columnProjects.map((project, index) => {
                const nextStatus = getNextStatus(project.status)
                const daysRemaining = getDaysRemaining(project.dueDate)
                const isOverdue = daysRemaining < 0 && project.status !== "completed"
                const completedSubtasks = project.subtasks.filter((st) => st.completed).length

                return (
                  <div key={project.id} data-swapy-slot={`${column.status}-${index}`} className="w-full">
                    <div data-swapy-item={project.id} className="w-full">
                      <TiltCard
                        className="transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover-glow-border"
                      >
                        <Card 
                          data-blendy-from={`project-${project.id}`}
                          className="h-full border-white/5 transition-all duration-500 hover:border-white/10"
                        >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-[15px] font-semibold leading-snug tracking-tight line-clamp-2 opacity-90">{project.title}</CardTitle>
                          <Badge
                            variant="secondary"
                            className="shrink-0 capitalize text-[9px] font-black tracking-wider bg-white/5 border-none opacity-40 hover:opacity-100 transition-opacity"
                          >
                            {project.priority}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <p className="text-[12px] text-white/30 font-medium leading-relaxed line-clamp-2">{project.description}</p>

                        {((typeof project.tags === 'string' ? JSON.parse(project.tags) : project.tags) as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {((typeof project.tags === 'string' ? JSON.parse(project.tags) : project.tags) as string[]).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{project.progress}%</span>
                          </div>
                          <Progress value={project.progress} className="h-2" />
                        </div>

                        {project.subtasks.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>
                              {completedSubtasks}/{project.subtasks.length} tasks
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground">
                              Start:{" "}
                              {new Date(project.startDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                              Due:{" "}
                              {new Date(project.dueDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs gap-1 ml-auto">
                              <AlertCircle className="h-3 w-3" />
                              {Math.abs(daysRemaining)}d overdue
                            </Badge>
                          )}
                          {!isOverdue && daysRemaining >= 0 && daysRemaining <= 7 && project.status !== "completed" && (
                            <Badge variant="secondary" className="text-xs ml-auto">
                              {daysRemaining}d left
                            </Badge>
                          )}
                        </div>

                        <div className="flex gap-2 pt-1">
                          {nextStatus && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 bg-transparent btn-press"
                              onClick={() => onStatusChange(project.id, nextStatus)}
                            >
                              Move
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleEditClick(project)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => onDelete(project.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" data-swapy-handle className="cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-3 w-3 opacity-60" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TiltCard>
                </div>
              </div>
            )
              })}

              <div data-swapy-slot={`${column.status}-empty`} className="h-10 w-full flex items-center justify-center border border-dashed border-white/[0.04] rounded-2xl text-[10px] text-white/20 hover:text-white/40 hover:border-white/10 hover:bg-white/[0.01] transition-all duration-300">
                Drop here
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
