"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { KanbanBoard } from "@/components/projects/kanban-board"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TasksView } from "@/components/projects/tasks-view"
import type { Project, ProjectStatus } from "@/types/project"
import { useToast } from "@/hooks/use-toast"
import { useProjects } from "@/hooks/use-swr"
import { useCognitiveEngine } from "@/lib/cognitive-context"
import { ScrollReveal } from "@/components/ui/scroll-reveal"

export default function ProjectsPage() {
  const { data: projects, error, isLoading, mutate } = useProjects()
  const { toast } = useToast()
  const { bioState } = useCognitiveEngine()
  const [activeTab, setActiveTab] = useState("projects")

  useEffect(() => {
    if (error) {
      toast({
        title: "Error fetching projects",
        description: "Could not fetch projects. Please try again later.",
        variant: "destructive",
      })
    }
  }, [error, toast])

  useEffect(() => {
    const handleVoiceCommand = (e: any) => {
      const action = e.detail?.action || e.detail?.result?.action
      if (
        action === "create_project" ||
        action === "update_project" ||
        action === "delete_project"
      ) {
        mutate()
      }
    }

    window.addEventListener("voice-command-executed", handleVoiceCommand)
    return () => {
      window.removeEventListener("voice-command-executed", handleVoiceCommand)
    }
  }, [mutate])

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
          body: JSON.stringify({ status })
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

  // ── Reduced Capacity Override: Single macro-task focus shield ─────────────────
  if (bioState.phase === 'REDUCED_CAPACITY_MODE') {
    const primaryTask = projects?.[0]
    return (
      <div className="flex flex-col gap-8 max-w-2xl mx-auto py-12 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
            Reduced Capacity Mode Active
          </div>
          <h1 className="text-3xl md:text-5xl font-light tracking-tight italic">Single Priority Shield</h1>
          <p className="text-xs text-foreground/40 uppercase tracking-widest leading-relaxed">
            Attentional capacity constrained by biometric fatigue. Secondary directive complexity hidden.
          </p>
        </div>

        <div className="rounded-[28px] p-8 border border-amber-500/20 relative overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(20, 10, 5, 0.8), rgba(9, 9, 11, 0.9))',
            backdropFilter: 'blur(24px)',
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-6">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400/80">Active Macro-Task</span>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground/95">
                {primaryTask ? primaryTask.title : "Deep Circadian Rest & Reset"}
              </h2>
              <p className="text-sm text-foreground/50 leading-relaxed">
                {primaryTask && primaryTask.description 
                  ? primaryTask.description 
                  : "Your current heart rate variability and sleep deficit require visual relief. Minimize complex decision paths."}
              </p>
            </div>

            <div className="h-px bg-foreground/[0.06]" />

            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30">Suggested Immediate Sub-Actions</span>
              
              <div className="space-y-3">
                {[
                  "Take a 5-minute warm water break",
                  "Enable the ambient lofi audio stream in the Context Capsule",
                  "Engage in deep-breathing cycle (4s in, 4s hold, 4s out)"
                ].map((action, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-amber-500/30 flex items-center justify-center text-[10px] text-amber-400 bg-amber-500/5">
                      ✓
                    </div>
                    <span className="text-xs text-foreground/70 font-medium">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10 md:gap-16">
      <ScrollReveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-light tracking-tight italic opacity-90">Projects & Tasks</h1>
            <p className="subtitle-technical">
              Active directives · system initiatives
            </p>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="relative grid w-full grid-cols-2 max-w-[400px] mb-6 bg-foreground/5 border border-foreground/5 rounded-full p-1 h-11">
          <TabsTrigger
            value="projects"
            className="relative h-9 rounded-full text-xs font-semibold data-[state=active]:bg-transparent data-[state=active]:text-foreground transition-colors duration-300"
          >
            {activeTab === 'projects' && (
              <motion.div
                layoutId="active-project-tab"
                className="absolute inset-0 bg-foreground/10 border border-foreground/10 rounded-full z-0"
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
            <span className="relative z-10">Projects</span>
          </TabsTrigger>
          <TabsTrigger
            value="tasks"
            className="relative h-9 rounded-full text-xs font-semibold data-[state=active]:bg-transparent data-[state=active]:text-foreground transition-colors duration-300"
          >
            {activeTab === 'tasks' && (
              <motion.div
                layoutId="active-project-tab"
                className="absolute inset-0 bg-foreground/10 border border-foreground/10 rounded-full z-0"
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
            <span className="relative z-10">Tasks</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setDialogOpen(true)} data-flip-from="btn-new-project" className="w-full sm:w-auto">
              <Plus data-shared-item="icon" className="h-4 w-4 mr-2" />
              <span data-shared-item="text">New Project</span>
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
      </ScrollReveal>

      <ProjectDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={editingProject ? handleUpdate : handleCreate}
        project={editingProject}
      />
    </div>
  )
}