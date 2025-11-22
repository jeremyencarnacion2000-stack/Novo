"use client"

import { useState, useEffect } from "react"
import { DashboardShell } from "@/components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { KanbanBoard } from "@/components/projects/kanban-board"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TasksView } from "@/components/projects/tasks-view"
import { useAnalyticsSession } from "@/hooks/use-analytics-session"
import type { Project, ProjectStatus } from "@/types/project"

export default function ProjectsPage() {
  useAnalyticsSession('projects')
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    const stored = localStorage.getItem("novo-projects")
    if (stored) {
      setProjects(JSON.parse(stored))
    } else {
      // Initial sample projects with new structure
      const initialProjects: Project[] = [
        {
          id: "1",
          title: "Website Redesign",
          description: "Modernize the company website with new design system",
          status: "in-progress",
          priority: "high",
          startDate: "2024-11-01",
          dueDate: "2024-12-31",
          progress: 45,
          tags: ["design", "web"],
          subtasks: [
            { id: "1", title: "Create wireframes", completed: true },
            { id: "2", title: "Design mockups", completed: true },
            { id: "3", title: "Develop frontend", completed: false },
          ],
          notes: "Using React and Tailwind CSS",
        },
        {
          id: "2",
          title: "Mobile App Development",
          description: "Build iOS and Android apps",
          status: "not-started",
          priority: "high",
          startDate: "2025-01-01",
          dueDate: "2025-03-15",
          progress: 0,
          tags: ["mobile", "development"],
          subtasks: [],
          notes: "",
        },
      ]
      setProjects(initialProjects)
      localStorage.setItem("novo-projects", JSON.stringify(initialProjects))
    }
  }, [])

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem("novo-projects", JSON.stringify(projects))
    }
  }, [projects])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | undefined>()

  const handleCreate = (project: Project | Omit<Project, "id">) => {
    const newProject = {
      ...project,
      id: Date.now().toString(),
    } as Project
    setProjects([...projects, newProject])
    setDialogOpen(false)
  }

  const handleUpdate = (project: Project | Omit<Project, "id">) => {
    setProjects(projects.map((p) => (p.id === (project as Project).id ? project as Project : p)))
    setDialogOpen(false)
    setEditingProject(undefined)
  }

  const handleDelete = (id: string) => {
    setProjects(projects.filter((p) => p.id !== id))
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingProject(undefined)
  }

  const handleStatusChange = (id: string, status: ProjectStatus) => {
    setProjects(projects.map((p) => (p.id === id ? { ...p, status } : p)))
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">Projects & Tasks</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Manage your projects and tasks with detailed tracking
            </p>
          </div>
        </div>

        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
            <KanbanBoard
              projects={projects}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksView />
          </TabsContent>
        </Tabs>

        <ProjectDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          onSave={editingProject ? handleUpdate : handleCreate}
          project={editingProject}
        />
      </div>
    </DashboardShell>
  )
}
