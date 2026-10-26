import React, { useState, useEffect, useCallback } from "react"
import { ThemeProvider } from "@/context/ThemeContext"
import { PrimarySidebar, type NavItemKey } from "@/components/layout/PrimarySidebar"
import { SecondarySidebar, type SecondaryNavKey } from "@/components/layout/SecondarySidebar"
import { Header } from "@/components/layout/Header"
import { RightSidebar } from "@/components/layout/RightSidebar"
import { KanbanBoard } from "@/components/kanban/KanbanBoard"
import { TaskDetailDrawer } from "@/components/kanban/TaskDetailDrawer"
import { CreateTaskModal } from "@/components/kanban/CreateTaskModal"
import { CreateProjectModal } from "@/components/project/CreateProjectModal"
import { Button } from "@/components/ui/Button"
import { api, type ApiProject, type ApiTask } from "@/services/api"
import { X, Sparkles, FolderPlus, Loader2, AlertCircle, RefreshCw } from "lucide-react"

export function AppContent() {
  // Navigation states
  const [activePrimaryNav, setActivePrimaryNav] = useState<NavItemKey>("tasks")
  const [activeSecondaryNav, setActiveSecondaryNav] = useState<SecondaryNavKey>("active_sprint")

  // Sidebar collapse states
  const [isSecondaryCollapsed, setIsSecondaryCollapsed] = useState(false)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Neon Data states
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [selectedProject, setSelectedProject] = useState<ApiProject | null>(null)
  const [tasks, setTasks] = useState<ApiTask[]>([])

  // UI state
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Modals state
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null)
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false)
  const [createTaskDefaultStatus, setCreateTaskDefaultStatus] = useState<"backlog" | "todo" | "in_progress" | "done">("todo")
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false)

  // 1. Load Projects from Neon PostgreSQL
  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true)
    setApiError(null)
    try {
      const data = await api.getProjects()
      setProjects(data)

      const savedProjectId = localStorage.getItem("management_web_project_id")
      const matched = data.find((p) => p.id === savedProjectId)
      if (matched) {
        setSelectedProject(matched)
      } else if (data.length > 0) {
        setSelectedProject(data[0])
      } else {
        setSelectedProject(null)
      }
    } catch (err: any) {
      setApiError(err.message || "Failed to connect to Neon PostgreSQL backend")
    } finally {
      setIsLoadingProjects(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // 2. Load Tasks for Selected Project
  const loadTasks = useCallback(async (projectId: string) => {
    setIsLoadingTasks(true)
    setApiError(null)
    try {
      const data = await api.getTasks(projectId)
      setTasks(data)
    } catch (err: any) {
      setApiError(err.message || "Failed to load tasks from Neon")
    } finally {
      setIsLoadingTasks(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem("management_web_project_id", selectedProject.id)
      loadTasks(selectedProject.id)
    } else {
      setTasks([])
    }
  }, [selectedProject, loadTasks])

  // Auto collapse sidebars on narrower viewports
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) setIsRightCollapsed(true)
      else setIsRightCollapsed(false)

      if (window.innerWidth < 1024) setIsSecondaryCollapsed(true)
      else setIsSecondaryCollapsed(false)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Handlers for Project Selection & Creation
  const handleSelectProject = (project: ApiProject) => {
    setSelectedProject(project)
  }

  const handleProjectCreated = (newProject: ApiProject) => {
    setProjects((prev) => [newProject, ...prev])
    setSelectedProject(newProject)
  }

  // Handlers for Task CRUD
  const handleTaskClick = (task: ApiTask) => {
    setSelectedTask(task)
  }

  const handleTaskCreated = (newTask: ApiTask) => {
    setTasks((prev) => [newTask, ...prev])
  }

  const handleTaskUpdated = (updated: ApiTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelectedTask(updated)
  }

  const handleTaskDeleted = (deletedId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== deletedId))
    if (selectedTask?.id === deletedId) {
      setSelectedTask(null)
    }
  }

  const handleQuickAdd = (status: "backlog" | "todo" | "in_progress" | "done") => {
    if (!selectedProject) {
      setIsCreateProjectModalOpen(true)
      return
    }
    setCreateTaskDefaultStatus(status)
    setIsCreateTaskModalOpen(true)
  }

  // Drag and Drop with Optimistic UI & Rollback
  const handleTaskMove = async (
    taskId: string,
    newStatus: "backlog" | "todo" | "in_progress" | "done",
    newPosition: number
  ) => {
    const previousTasks = [...tasks]
    const targetTask = tasks.find((t) => t.id === taskId)
    if (!targetTask) return

    // Optimistically update local state
    setTasks((prev) => {
      const remaining = prev.filter((t) => t.id !== taskId)
      const updatedTarget: ApiTask = {
        ...targetTask,
        status: newStatus,
        position: newPosition,
      }

      // Re-insert into target column at newPosition
      const colTasks = remaining.filter((t) => t.status === newStatus)
      const otherTasks = remaining.filter((t) => t.status !== newStatus)

      colTasks.splice(newPosition, 0, updatedTarget)
      // update position index for colTasks
      const reindexedColTasks = colTasks.map((t, idx) => ({ ...t, position: idx }))

      return [...otherTasks, ...reindexedColTasks]
    })

    try {
      await api.reorderTask(taskId, newStatus, newPosition)
    } catch (err: any) {
      // Rollback on error
      setTasks(previousTasks)
      setApiError(`Drag & drop failed: ${err.message}. Changes rolled back.`)
      setTimeout(() => setApiError(null), 4000)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 1. Primary Sidebar (Desktop) */}
      <PrimarySidebar
        activeItem={activePrimaryNav}
        onSelectItem={(item) => {
          setActivePrimaryNav(item)
          if (item === "tasks") setActiveSecondaryNav("active_sprint")
          if (item === "dashboard") setActiveSecondaryNav("dashboard")
          if (item === "reports") setActiveSecondaryNav("reports")
        }}
        className="hidden md:flex"
      />

      {/* 2. Secondary Sidebar (Desktop) */}
      <SecondarySidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onCreateProjectClick={() => setIsCreateProjectModalOpen(true)}
        activeItem={activeSecondaryNav}
        onSelectItem={(item) => setActiveSecondaryNav(item)}
        isCollapsed={isSecondaryCollapsed}
        onToggleCollapse={() => setIsSecondaryCollapsed((prev) => !prev)}
        tasksCount={tasks.length}
        className="hidden md:flex"
      />

      {/* Mobile Drawer (Combines Primary & Secondary navigation) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex h-full z-10">
            <PrimarySidebar
              activeItem={activePrimaryNav}
              onSelectItem={(item) => {
                setActivePrimaryNav(item)
                setIsMobileMenuOpen(false)
              }}
            />
            <div className="w-64 bg-card h-full flex flex-col border-r border-border">
              <div className="flex items-center justify-between p-3 border-b border-border">
                <span className="text-xs font-bold">Workspace Navigation</span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SecondarySidebar
                  projects={projects}
                  selectedProject={selectedProject}
                  onSelectProject={(p) => {
                    handleSelectProject(p)
                    setIsMobileMenuOpen(false)
                  }}
                  onCreateProjectClick={() => {
                    setIsCreateProjectModalOpen(true)
                    setIsMobileMenuOpen(false)
                  }}
                  activeItem={activeSecondaryNav}
                  onSelectItem={(item) => {
                    setActiveSecondaryNav(item)
                    setIsMobileMenuOpen(false)
                  }}
                  isCollapsed={false}
                  onToggleCollapse={() => setIsMobileMenuOpen(false)}
                  tasksCount={tasks.length}
                  className="w-full border-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Column: Header + Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header
          currentProject={selectedProject}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateTaskClick={() => {
            if (!selectedProject) {
              setIsCreateProjectModalOpen(true)
            } else {
              setCreateTaskDefaultStatus("todo")
              setIsCreateTaskModalOpen(true)
            }
          }}
          onToggleSecondarySidebar={() => setIsSecondaryCollapsed((prev) => !prev)}
          onToggleRightSidebar={() => setIsRightCollapsed((prev) => !prev)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          isSecondaryCollapsed={isSecondaryCollapsed}
          isRightCollapsed={isRightCollapsed}
        />

        {/* Global Error Alert Banner */}
        {apiError && (
          <div className="flex items-center justify-between bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-xs text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{apiError}</span>
            </div>
            <button
              type="button"
              onClick={() => selectedProject && loadTasks(selectedProject.id)}
              className="flex items-center gap-1 font-semibold hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* Dynamic View Container */}
        <main className="flex flex-1 overflow-hidden relative">
          {isLoadingProjects ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Connecting to Neon PostgreSQL...</span>
            </div>
          ) : projects.length === 0 ? (
            /* Empty State: No projects exist yet in Neon */
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-surface/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <FolderPlus className="h-7 w-7" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                No Projects on Neon PostgreSQL
              </h2>
              <p className="mt-2 text-xs text-muted-foreground max-w-sm leading-relaxed">
                Your Neon PostgreSQL database is connected and ready. Create your first project workspace to start managing tasks.
              </p>
              <Button
                onClick={() => setIsCreateProjectModalOpen(true)}
                className="mt-4 gap-2 font-semibold shadow"
              >
                <FolderPlus className="h-4 w-4" />
                <span>Create First Project</span>
              </Button>
            </div>
          ) : activeSecondaryNav === "active_sprint" ? (
            isLoadingTasks ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Loading active sprint tasks from Neon...</span>
              </div>
            ) : (
              <KanbanBoard
                tasks={tasks}
                searchQuery={searchQuery}
                onTaskClick={handleTaskClick}
                onQuickAdd={handleQuickAdd}
                onTaskMove={handleTaskMove}
              />
            )
          ) : (
            /* Informative placeholder for other sections */
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-surface/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                {activeSecondaryNav.replace("_", " ").toUpperCase()} VIEW
              </h2>
              <p className="mt-2 text-xs text-muted-foreground max-w-md leading-relaxed">
                Active Sprint Kanban is connected directly to Neon PostgreSQL. Additional analytical views will be activated in subsequent phases.
              </p>
              <Button
                onClick={() => setActiveSecondaryNav("active_sprint")}
                className="mt-4"
              >
                Back to Active Sprint Kanban
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* 4. Right Sidebar (Desktop & Tablet) */}
      <RightSidebar
        tasks={tasks}
        isCollapsed={isRightCollapsed}
        onToggleCollapse={() => setIsRightCollapsed((prev) => !prev)}
        onTaskClick={handleTaskClick}
        className="hidden md:flex"
      />

      {/* Task Detail Slide-over Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />

      {/* Create Task Modal */}
      {selectedProject && (
        <CreateTaskModal
          open={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          projectId={selectedProject.id}
          defaultStatus={createTaskDefaultStatus}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
