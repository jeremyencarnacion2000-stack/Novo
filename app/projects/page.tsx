"use client"

import { useState, useEffect } from "react"
import { DashboardShell } from "@/components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { KanbanBoard } from "@/components/projects/kanban-board"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TasksView } from "@/components/projects/tasks-view"
import type { Project, ProjectStatus } from "@/types/project"
import { useToast } from "@/hooks/use-toast"
import { useProjects } from "@/hooks/use-swr"

export default function ProjectsPage() {
  const { data: projects, error, isLoading, mutate } = useProjects()
  const { toast } = useToast()

  useEffect(() => {
    if (error) {
      toast({
        title: "Error fetching projects",
        description: "Could not fetch projects. Please try again later.",
        variant: "destructive",
      })
    }
  }, [error, toast])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | undefined>()

  const handleCreate = async (project: Project | Omit<Project, "id">) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      })
      if (response.ok) {
        mutate()
        setDialogOpen(false)
        toast({
          title: "Project created",
          description: "Your new project has been created successfully.",
        })
      } else {
        toast({
          title: "Error creating project",
          description: "Could not create project. Please try again later.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast({
        title: "Error creating project",
        description: "Could not create project. Please try again later.",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = async (project: Project | Omit<Project, "id">) => {
    try {
      const response = await fetch(`/api/projects/${(project as Project).id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      })
      if (response.ok) {
        mutate()
        setDialogOpen(false)
        setEditingProject(undefined)
        toast({
          title: "Project updated",
          description: "Your project has been updated successfully.",
        })
      } else {
        toast({
          title: "Error updating project",
          description: "Could not update project. Please try again later.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error updating project:', error)
      toast({
        title: "Error updating project",
        description: "Could not update project. Please try again later.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        mutate()
        toast({
          title: "Project deleted",
          description: "Your project has been deleted successfully.",
        })
      } else {
        toast({
          title: "Error deleting project",
          description: "Could not delete project. Please try again later.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      toast({
        title: "Error deleting project",
        description: "Could not delete project. Please try again later.",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setDialogOpen(true)
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingProject(undefined)
  }

  const handleStatusChange = async (id: string, status: ProjectStatus) => {
    try {
      const project = projects?.find(p => p.id === id)
      if (project) {
        const response = await fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...project, status })
        })
        if (response.ok) {
          mutate()
          toast({
            title: "Project status updated",
            description: "Your project's status has been updated successfully.",
          })
        } else {
          toast({
            title: "Error updating project status",
            description: "Could not update project status. Please try again later.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error('Error updating project status:', error)
      toast({
        title: "Error updating project status",
        description: "Could not update project status. Please try again later.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
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
              projects={projects || []}
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