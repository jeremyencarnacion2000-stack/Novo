"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Calendar, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react"
import type { Project, ProjectStatus } from "@/types/project"
import { Progress } from "@/components/ui/progress"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { createSwapy } from "swapy"

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

// Maps a slot ID → the ProjectStatus it belongs to.
// Slot IDs are either the project's own ID (stable) or "empty-<status>" for drop zones.
function resolveStatusFromSlot(
  slotId: string,
  slotRegistry: Map<string, ProjectStatus>
): ProjectStatus | null {
  // empty drop zone: "empty-not-started", "empty-in-progress", "empty-completed"
  if (slotId.startsWith("empty-")) {
    return slotId.replace("empty-", "") as ProjectStatus
  }
  return slotRegistry.get(slotId) ?? null
}

function getNextStatus(currentStatus: ProjectStatus): ProjectStatus | null {
  if (currentStatus === "not-started") return "in-progress"
  if (currentStatus === "in-progress") return "completed"
  return null
}

function getDaysRemaining(dueDate: string): number {
  const due = new Date(dueDate)
  const today = new Date()
  const diffTime = due.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

interface EnrichedProject extends Project {
  tagList: string[]
  nextStatus: ProjectStatus | null
  daysRemaining: number
  isOverdue: boolean
  completedSubtasks: number
  startDateLabel: string
  dueDateLabel: string
}

export function KanbanBoard({ projects, onEdit, onDelete, onStatusChange }: KanbanBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const swapyRef = useRef<any>(null)
  // Keeps a stable map of projectId → current column status so the onSwap
  // callback (closed over once at init) can still read the latest mapping.
  const slotRegistryRef = useRef<Map<string, ProjectStatus>>(new Map())
  const onStatusChangeRef = useRef(onStatusChange)

  // Keep refs fresh without re-initialising Swapy
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  })

  const enrichedProjects: EnrichedProject[] = useMemo(() => {
    return projects.map((project) => {
      const daysRemaining = getDaysRemaining(project.dueDate)
      return {
        ...project,
        tagList: (typeof project.tags === 'string' ? JSON.parse(project.tags) : project.tags) as string[],
        nextStatus: getNextStatus(project.status),
        daysRemaining,
        isOverdue: daysRemaining < 0 && project.status !== "completed",
        completedSubtasks: project.subtasks.filter((st) => st.completed).length,
        startDateLabel: new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        dueDateLabel: new Date(project.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      }
    })
  }, [projects])

  const columnGroups = useMemo(() => {
    return columns.map((column) => ({
      column,
      items: enrichedProjects.filter((p) => p.status === column.status),
    }))
  }, [enrichedProjects])

  // Rebuild the slot registry whenever projects change
  useEffect(() => {
    const map = new Map<string, ProjectStatus>()
    for (const p of projects) {
      // Slot ID = project ID (stable, unique)
      map.set(p.id, p.status as ProjectStatus)
    }
    slotRegistryRef.current = map
  }, [projects])

  // ── Swapy init (once) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    swapyRef.current = createSwapy(containerRef.current, {
      manualSwap: true,
      animation: "dynamic",
    })

    swapyRef.current.onSwap(({ newSlotItemMap }: any) => {
      // newSlotItemMap.asObject: { [slotId]: itemId | null }
      const entries = Object.entries(newSlotItemMap.asObject) as [string, string | null][]
      // Resolve every entry against a frozen snapshot of the registry FIRST —
      // a swap between two columns produces two entries in the same event,
      // and mutating the (shared) registry while still reading it mid-loop
      // meant the second entry's lookup could read the first entry's write,
      // sending one of the two projects to the wrong column.
      const snapshot = new Map(slotRegistryRef.current)
      const moves: Array<{ itemId: string; newStatus: ProjectStatus }> = []
      for (const [slotId, itemId] of entries) {
        if (!itemId) continue
        const newStatus = resolveStatusFromSlot(slotId, snapshot)
        if (!newStatus) continue
        const currentStatus = snapshot.get(itemId)
        if (currentStatus && currentStatus !== newStatus) {
          moves.push({ itemId, newStatus })
        }
      }
      for (const { itemId, newStatus } of moves) {
        // Optimistic local registry update so duplicate calls don't fire
        slotRegistryRef.current.set(itemId, newStatus)
        onStatusChangeRef.current(itemId, newStatus)
      }
    })

    return () => {
      swapyRef.current?.destroy()
    }
  }, []) // ← intentionally empty: init once

  // ── Notify Swapy when the DOM changes (items added / removed / reordered) ──
  useEffect(() => {
    swapyRef.current?.update()
  }, [projects])

  const handleEditClick = (project: Project) => {
    onEdit(project)
  }

  return (
    <div className="grid gap-6 md:grid-cols-3" ref={containerRef}>
      {columnGroups.map(({ column, items: columnProjects }) => {
        return (
          <div
            key={column.status}
            className="flex flex-col gap-4"
          >
            <div className={cn("glass-header border-none bg-foreground/[0.03] rounded-[20px] mb-2", column.color)}>
              <div className="flex items-center justify-between px-3">
                <h3 className="subtitle-technical px-0">{column.title}</h3>
                <Badge variant="secondary" className="bg-foreground/5 border-none opacity-50 px-2 h-5 text-[9px] font-black">{columnProjects.length}</Badge>
              </div>
            </div>

            <div className="space-y-3 min-h-[200px] rounded-lg transition-colors">
              {columnProjects.map((project) => {
                const { nextStatus, daysRemaining, isOverdue, completedSubtasks, tagList, startDateLabel, dueDateLabel } = project

                return (
                  // Slot ID = project ID (stable, unique) so Swapy can track it across re-renders
                  <div key={project.id} data-swapy-slot={project.id} className="w-full">
                    <div data-swapy-item={project.id} className="w-full">
                        <Card
                          data-flip-from={`project-${project.id}`}
                          className="h-full border-foreground/5 transition-all duration-500 hover:border-foreground/10 hover-glow-border"
                        >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle data-shared-item="text" className="text-[15px] font-semibold leading-snug tracking-tight line-clamp-2 opacity-90">{project.title}</CardTitle>
                          <Badge
                            variant="secondary"
                            className="shrink-0 capitalize text-[9px] font-black tracking-wider bg-foreground/5 border-none opacity-40 hover:opacity-100 transition-opacity"
                          >
                            {project.priority}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <p className="text-[12px] text-foreground/30 font-medium leading-relaxed line-clamp-2">{project.description}</p>

                        {tagList.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tagList.map((tag) => (
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
                              {startDateLabel}
                            </span>
                            <span className={isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                              Due:{" "}
                              {dueDateLabel}
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
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )
              })}

              {/* Empty drop zone — stable slot ID: "empty-<status>" */}
              <div
                data-swapy-slot={`empty-${column.status}`}
                className="h-10 w-full"
              >
                <div
                  data-swapy-item={`placeholder-${column.status}`}
                  data-swapy-no-drag
                  className="h-10 w-full flex items-center justify-center border border-dashed border-foreground/[0.04] rounded-2xl text-[10px] text-foreground/20 hover:text-foreground/40 hover:border-foreground/10 hover:bg-foreground/[0.01] transition-all duration-300"
                >
                  Drop here
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
