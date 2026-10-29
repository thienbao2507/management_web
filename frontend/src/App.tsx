import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react"
import { ThemeProvider } from "@/context/ThemeContext"
import { UserProvider, useUsers } from "@/context/UserContext"
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext"
import { useProjectWorkspace, type WorkspaceToken } from "@/context/useProjectWorkspace"
import { IdentityDialog } from "@/components/identity/IdentityDialog"
import { AuthPage } from "@/components/identity/AuthPage"
import { ProjectMembers } from "@/components/project/ProjectMembers"
import { PrimarySidebar, type NavItemKey } from "@/components/layout/PrimarySidebar"
import { SecondarySidebar, type SecondaryNavKey } from "@/components/layout/SecondarySidebar"
import { Header } from "@/components/layout/Header"
import { RightSidebar } from "@/components/layout/RightSidebar"
import { KanbanBoard } from "@/components/kanban/KanbanBoard"
import { TaskDetailDrawer } from "@/components/kanban/TaskDetailDrawer"
import { CreateTaskModal } from "@/components/kanban/CreateTaskModal"
import { CreateProjectModal } from "@/components/project/CreateProjectModal"
import { CreateWorkspaceModal } from "@/components/workspace/CreateWorkspaceModal"
import { ResourcePage } from "@/components/resources/ResourcePage"
import { Button } from "@/components/ui/Button"
import { api, type ApiProject, type ApiTask } from "@/services/api"
import { X, Sparkles, FolderPlus, Loader2, AlertCircle, RefreshCw } from "lucide-react"

const viewPaths: Record<SecondaryNavKey, string> = {
  dashboard: "/dashboard", roadmap: "/roadmap", active_sprint: "/active-sprint",
  resources: "/resources", issues: "/issues", releases: "/releases",
  team: "/team", settings: "/settings",
}

function readView(): SecondaryNavKey {
  return (Object.entries(viewPaths).find(([, path]) => `#${path}` === window.location.hash)?.[0] as SecondaryNavKey) || "active_sprint"
}

function primaryForView(view: SecondaryNavKey): NavItemKey {
  return view === "resources" ? "resources" : view === "dashboard" ? "dashboard" : view === "settings" ? "settings" : "tasks"
}

export function AppContent() {
  const { currentUser, loading: identityLoading, error: identityError, refresh: refreshIdentity, openIdentity, ingestUsers } = useUsers()
  const { workspace: currentWorkspace, loading: workspaceLoading, error: workspaceError, scopeKey: workspaceScopeKey, refresh: refreshWorkspace } = useWorkspace()
  const [sharedMode, setSharedMode] = useState(false)
  const parentScopeKey = sharedMode ? JSON.stringify([currentUser?.id || "anonymous", "shared"]) : workspaceScopeKey
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // Navigation states
  const [activePrimaryNav, setActivePrimaryNav] = useState<NavItemKey>(() => primaryForView(readView()))
  const [activeSecondaryNav, setActiveSecondaryNav] = useState<SecondaryNavKey>(readView)
  const isResourcesView = activeSecondaryNav === "resources"
  const [resourceSearch, setResourceSearch] = useState("")
  const [resourceAddRequest, setResourceAddRequest] = useState(0)

  const navigateView = useCallback((view: SecondaryNavKey) => {
    setActiveSecondaryNav(view)
    setActivePrimaryNav(primaryForView(view))
    window.location.hash = viewPaths[view]
    setIsMobileMenuOpen(false)
  }, [])

  const navigatePrimary = (item: NavItemKey) => {
    navigateView(item === "resources" ? "resources" : item === "dashboard" ? "dashboard" : item === "settings" ? "settings" : "active_sprint")
  }

  useEffect(() => {
    const syncView = () => {
      const view = readView()
      setActiveSecondaryNav(view)
      setActivePrimaryNav(primaryForView(view))
      setIsMobileMenuOpen(false)
    }
    if (!window.location.hash) window.history.replaceState(null, "", "#/active-sprint")
    window.addEventListener("hashchange", syncView)
    return () => window.removeEventListener("hashchange", syncView)
  }, [])

  // Sidebar collapse states
  const [isSecondaryCollapsed, setIsSecondaryCollapsed] = useState(false)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)

  // Neon Data states
  const [projects, setProjects] = useState<ApiProject[]>([])
  const [selectedProject, setSelectedProject] = useState<ApiProject | null>(null)
  const [sprintScope, setSprintScope] = useState<{ projectId?: string; parentScopeKey?: string; value: string }>({ value: "all" })
  const sprintFilter = sprintScope.projectId === selectedProject?.id && sprintScope.parentScopeKey === parentScopeKey ? sprintScope.value : "all"
  const workspace = useProjectWorkspace(selectedProject?.id, currentUser?.id, sprintFilter, parentScopeKey)
  const { tasks, tasksLoading: isLoadingTasks, members, membersLoading, membersError, sprints, sprintsError } = workspace
  const setTasks = workspace.mutateTasks
  const projectPreferenceKey = `management_web_project_id:${currentUser?.id || "anonymous"}:${sharedMode ? "shared" : currentWorkspace?.id || "no-workspace"}`
  const projectRequest = useRef(0)
  const projectAbort = useRef<AbortController | null>(null)
  const activePreference = useRef(projectPreferenceKey)
  useLayoutEffect(() => { activePreference.current = projectPreferenceKey }, [projectPreferenceKey])

  // UI state
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Modals state
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null)
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false)
  const [createTaskContext, setCreateTaskContext] = useState<WorkspaceToken | null>(null)
  const [createTaskDefaultStatus, setCreateTaskDefaultStatus] = useState<"backlog" | "todo" | "in_progress" | "done">("todo")
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false)
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false)

  // Load Projects only inside the personal Workspace or explicit shared scope.
  const loadProjects = useCallback(async () => {
    const requestId = ++projectRequest.current
    projectAbort.current?.abort()
    const controller = new AbortController()
    projectAbort.current = controller
    if (!sharedMode && !currentWorkspace) {
      setProjects([])
      setSelectedProject(null)
      setIsLoadingProjects(false)
      setApiError(null)
      return
    }
    setIsLoadingProjects(true)
    setApiError(null)
    try {
      const data = await api.getProjects(
        false,
        controller.signal,
        sharedMode ? { shared: true } : { workspace_id: currentWorkspace?.id }
      )
      if (controller.signal.aborted || projectRequest.current !== requestId || activePreference.current !== projectPreferenceKey) return
      setProjects(data)

      const savedProjectId = localStorage.getItem(projectPreferenceKey)
      const matched = data.find((p) => p.id === savedProjectId)
      if (matched) {
        setSelectedProject(matched)
      } else if (data.length > 0) {
        setSelectedProject(data[0])
      } else {
        setSelectedProject(null)
      }
      const next = matched || data[0]
      if (next) localStorage.setItem(projectPreferenceKey, next.id)
      else localStorage.removeItem(projectPreferenceKey)
    } catch (err: any) {
      if (controller.signal.aborted || projectRequest.current !== requestId) return
      setApiError(err.message || "Failed to connect to Neon PostgreSQL backend")
    } finally {
      if (!controller.signal.aborted && projectRequest.current === requestId) setIsLoadingProjects(false)
    }
  }, [currentWorkspace, sharedMode, projectPreferenceKey])

  useEffect(() => {
    if (!identityLoading && !workspaceLoading) void loadProjects()
    return () => { projectAbort.current?.abort() }
  }, [loadProjects, identityLoading, workspaceLoading])

  useEffect(() => {
    setSharedMode(false)
  }, [currentUser?.id])

  useEffect(() => {
    setSelectedTask(null)
    setIsCreateTaskModalOpen(false)
    setIsCreateProjectModalOpen(false)
    setIsCreateWorkspaceModalOpen(false)
    setResourceAddRequest(0)
    setApiError(null)
  }, [parentScopeKey, workspace.token])

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
    setSprintScope({ projectId: project.id, parentScopeKey, value: "all" })
    setSelectedTask(null)
    setIsCreateTaskModalOpen(false)
    localStorage.setItem(projectPreferenceKey, project.id)
    setSelectedProject(project)
  }

  const handleProjectCreated = (newProject: ApiProject) => {
    if (sharedMode || !currentWorkspace || newProject.workspace_id !== currentWorkspace.id) return
    setProjects((prev) => [newProject, ...prev])
    if (activePreference.current === projectPreferenceKey) {
      localStorage.setItem(projectPreferenceKey, newProject.id)
      setSelectedProject(newProject)
    }
  }

  // Handlers for Task CRUD
  const handleTaskClick = (task: ApiTask) => {
    if (task.project_id === selectedProject?.id && tasks.some((item) => item.id === task.id)) setSelectedTask(task)
  }

  const handleTaskCreated = (newTask: ApiTask) => {
    if (!workspace.isCurrent(workspace.token) || newTask.project_id !== selectedProject?.id) return
    if (newTask.assignee) ingestUsers([newTask.assignee])
    setTasks((prev) => [newTask, ...prev])
  }

  const handleTaskUpdated = (updated: ApiTask) => {
    if (!workspace.isCurrent(workspace.token) || updated.project_id !== selectedProject?.id) return
    if (updated.assignee) ingestUsers([updated.assignee])
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setSelectedTask(updated)
  }

  const handleTaskDeleted = (deletedId: string) => {
    if (!workspace.isCurrent(workspace.token)) return
    setTasks((prev) => prev.filter((t) => t.id !== deletedId))
    if (selectedTask?.id === deletedId) {
      setSelectedTask(null)
    }
  }

  const handleQuickAdd = (status: "backlog" | "todo" | "in_progress" | "done") => {
    if (!selectedProject) {
      if (currentWorkspace && !sharedMode) setIsCreateProjectModalOpen(true)
      else if (!sharedMode) setIsCreateWorkspaceModalOpen(true)
      return
    }
    setCreateTaskDefaultStatus(status)
    setCreateTaskContext(workspace.token)
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
      await api.reorderTask(taskId, newStatus, newPosition, !["all", "unsprinted"].includes(sprintFilter) ? sprintFilter : undefined, sprintFilter === "unsprinted")
    } catch (err: any) {
      if (!workspace.isCurrent(workspace.token)) return
      // Rollback on error
      setTasks(() => previousTasks)
      setApiError(`Drag & drop failed: ${err.message}. Changes rolled back.`)
      setTimeout(() => { if (workspace.isCurrent(workspace.token)) setApiError(null) }, 4000)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 1. Primary Sidebar (Desktop) */}
      <PrimarySidebar
        activeItem={activePrimaryNav}
        onSelectItem={navigatePrimary}
        className="hidden md:flex"
      />

      {/* 2. Secondary Sidebar (Desktop) */}
      <SecondarySidebar
        currentWorkspace={currentWorkspace}
        workspaceLoading={workspaceLoading}
        workspaceError={workspaceError}
        legacyMode={sharedMode}
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onCreateProjectClick={() => setIsCreateProjectModalOpen(true)}
        onCreateWorkspaceClick={() => setIsCreateWorkspaceModalOpen(true)}
        onSelectUnassigned={() => setSharedMode((value) => !value)}
        activeItem={activeSecondaryNav}
        onSelectItem={navigateView}
        isCollapsed={isSecondaryCollapsed}
        onToggleCollapse={() => setIsSecondaryCollapsed((prev) => !prev)}
        tasksCount={tasks.length}
        membersCount={membersLoading || membersError ? null : members.length}
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
              onSelectItem={navigatePrimary}
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
                  currentWorkspace={currentWorkspace}
                  workspaceLoading={workspaceLoading}
                  workspaceError={workspaceError}
                  legacyMode={sharedMode}
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
                  onCreateWorkspaceClick={() => {
                    setIsCreateWorkspaceModalOpen(true)
                    setIsMobileMenuOpen(false)
                  }}
                  onSelectUnassigned={() => {
                    setSharedMode((value) => !value)
                    setIsMobileMenuOpen(false)
                  }}
                  activeItem={activeSecondaryNav}
                  onSelectItem={(item) => {
                    navigateView(item)
                  }}
                  isCollapsed={false}
                  onToggleCollapse={() => setIsMobileMenuOpen(false)}
                  tasksCount={tasks.length}
                  membersCount={membersLoading || membersError ? null : members.length}
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
          currentWorkspace={currentWorkspace}
          legacyMode={sharedMode}
          currentProject={selectedProject}
          searchQuery={isResourcesView ? resourceSearch : searchQuery}
          onSearchChange={isResourcesView ? setResourceSearch : setSearchQuery}
          isResourcesView={isResourcesView}
          onCreateResourceClick={() => setResourceAddRequest((value) => value + 1)}
          createTaskDisabled={!selectedProject || isLoadingProjects || isLoadingTasks || Boolean(workspace.tasksError)}
          onCreateTaskClick={() => {
            handleQuickAdd("todo")
          }}
          onToggleSecondarySidebar={() => setIsSecondaryCollapsed((prev) => !prev)}
          onToggleRightSidebar={() => setIsRightCollapsed((prev) => !prev)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          isSecondaryCollapsed={isSecondaryCollapsed}
          isRightCollapsed={isRightCollapsed}
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          onMembersClick={() => navigateView("team")}
          sprintLabel={activeSecondaryNav === "team" ? "Team Members" : sprintFilter === "all" ? "All tasks" : sprintFilter === "unsprinted" ? "Unsprinted / Backlog" : sprints.find((sprint) => sprint.id === sprintFilter)?.name || "Sprint"}
        />

        {/* Global Error Alert Banner */}
        {identityError && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-4 py-2 text-xs text-muted-foreground"><span>{identityError}</span><Button variant="outline" size="sm" onClick={() => void refreshIdentity()}>Retry</Button></div>}
        {((!sharedMode && workspaceError) || apiError || workspace.tasksError) && (
          <div className="flex items-center justify-between bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-xs text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{(!sharedMode && workspaceError) || apiError || workspace.tasksError}</span>
            </div>
            <button
              type="button"
              onClick={() => !sharedMode && workspaceError ? void refreshWorkspace() : apiError || !selectedProject ? void loadProjects() : workspace.refresh()}
              className="flex items-center gap-1 font-semibold hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* Dynamic View Container */}
        <main className="flex flex-1 overflow-hidden relative">
          {identityLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Restoring your session...</span>
            </div>
          ) : !currentUser ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <h2 className="text-base font-bold">Sign in to Management Web</h2>
              <p className="max-w-sm text-xs text-muted-foreground">Use your verified account to access your personal Workspace and Projects shared with you.</p>
              <div className="flex gap-2"><Button onClick={() => openIdentity("login")}>Sign in</Button><Button variant="outline" onClick={() => openIdentity("register")}>Register</Button></div>
            </div>
          ) : workspaceLoading && !sharedMode ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span>Loading personal Workspace...</span></div>
          ) : workspaceError && !sharedMode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <h2 className="text-base font-bold">Workspace unavailable</h2>
              <p className="max-w-md text-xs text-muted-foreground">{workspaceError}</p>
              <div className="flex gap-2"><Button variant="outline" onClick={() => void refreshWorkspace()}>Retry</Button><Button variant="outline" onClick={() => setSharedMode(true)}>View shared Projects</Button></div>
            </div>
          ) : !currentWorkspace && !sharedMode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <h2 className="text-base font-bold">No personal Workspace yet</h2>
              <p className="max-w-sm text-xs text-muted-foreground">Create a personal Workspace for {currentUser.display_name}, or open a Project shared with your account.</p>
              <div className="flex gap-2"><Button onClick={() => setIsCreateWorkspaceModalOpen(true)}>Create Workspace</Button><Button variant="outline" onClick={() => setSharedMode(true)}>View shared Projects</Button></div>
            </div>
          ) : isLoadingProjects ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span>Loading scoped Projects...</span></div>
          ) : apiError && projects.length === 0 ? null : isResourcesView ? (
            <ResourcePage
              workspaceId={sharedMode ? undefined : currentWorkspace?.id}
              shared={sharedMode}
              scopeKey={parentScopeKey}
              projects={projects}
              selectedProject={selectedProject}
              searchQuery={resourceSearch}
              onSearchChange={setResourceSearch}
              addRequestId={resourceAddRequest}
            />
          ) : projects.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-surface/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <FolderPlus className="h-7 w-7" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                {sharedMode ? "No shared Projects" : "No Projects in this Workspace"}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground max-w-sm leading-relaxed">
                {sharedMode ? "No Projects have been shared with your verified account." : "Create the first Project inside this Workspace to start managing tasks."}
              </p>
              <Button
                onClick={() => sharedMode ? setSharedMode(false) : setIsCreateProjectModalOpen(true)}
                className="mt-4 gap-2 font-semibold shadow"
              >
                <FolderPlus className="h-4 w-4" />
                <span>{sharedMode ? "Back to Workspace" : "Create First Project"}</span>
              </Button>
            </div>
          ) : activeSecondaryNav === "team" && selectedProject ? (
            <ProjectMembers key={selectedProject.id} projectId={selectedProject.id} members={members} loading={membersLoading} error={membersError} onRefresh={workspace.refresh} canManage={!sharedMode} />
          ) : activeSecondaryNav === "active_sprint" ? (
            isLoadingTasks ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Loading active sprint tasks from Neon...</span>
              </div>
            ) : workspace.tasksError ? <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-xs text-muted-foreground"><p>Tasks could not be loaded. Use Retry above.</p>{sprintFilter !== "all" && <Button variant="outline" onClick={() => setSprintScope({ projectId: selectedProject?.id, parentScopeKey, value: "all" })}>Show all project tasks</Button>}</div> : (
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
                  <label htmlFor="workspace-sprint" className="font-medium">Sprint</label>
                  <select id="workspace-sprint" value={sprintFilter} onChange={(event) => { setSelectedTask(null); setIsCreateTaskModalOpen(false); setSprintScope({ projectId: selectedProject?.id, parentScopeKey, value: event.target.value }) }} className="h-8 max-w-full rounded-md border border-border bg-background px-2 text-xs" disabled={workspace.sprintsLoading || Boolean(sprintsError)}>
                    <option value="all">All project tasks (includes unsprinted)</option>
                    <option value="unsprinted">Unsprinted / Backlog</option>
                    {sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} ({sprint.status})</option>)}
                  </select>
                  {sprintsError ? <span role="alert" className="text-red-600 dark:text-red-400">{sprintsError}</span> : sprints.filter((sprint) => sprint.status === "active").length > 1 ? <span className="text-muted-foreground">Multiple active sprints. Choose one explicitly, or keep all tasks visible.</span> : <span className="text-muted-foreground">Legacy tasks remain visible in All project tasks.</span>}
                </div>
                <KanbanBoard
                key={workspace.token.key}
                tasks={tasks}
                searchQuery={searchQuery}
                onTaskClick={handleTaskClick}
                onQuickAdd={handleQuickAdd}
                onTaskMove={handleTaskMove}
              />
              </div>
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
                onClick={() => navigateView("active_sprint")}
                className="mt-4"
              >
                Back to Active Sprint Kanban
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* 4. Right Sidebar (Desktop & Tablet) */}
      {!isResourcesView && <RightSidebar
        tasks={tasks}
        loading={isLoadingProjects || isLoadingTasks}
        error={apiError || workspace.tasksError}
        isCollapsed={isRightCollapsed}
        onToggleCollapse={() => setIsRightCollapsed((prev) => !prev)}
        onTaskClick={handleTaskClick}
        className="hidden md:flex"
      />}

      {/* Task Detail Slide-over Drawer */}
      {selectedTask && tasks.some((task) => task.id === selectedTask.id) && <TaskDetailDrawer
        key={selectedTask.id}
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => { if (workspace.isCurrent(workspace.token)) setSelectedTask(null) }}
        members={members}
        membersError={membersError}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />}

      {/* Create Task Modal */}
      {selectedProject && isCreateTaskModalOpen && createTaskContext === workspace.token && (
        <CreateTaskModal
          open={isCreateTaskModalOpen}
          onClose={() => { if (workspace.isCurrent(workspace.token)) setIsCreateTaskModalOpen(false) }}
          projectId={selectedProject.id}
          sprintId={!["all", "unsprinted"].includes(sprintFilter) ? sprintFilter : null}
          members={members}
          membersError={membersError}
          membersLoading={membersLoading}
          defaultStatus={createTaskDefaultStatus}
          onTaskCreated={handleTaskCreated}
        />
      )}

      <CreateWorkspaceModal open={isCreateWorkspaceModalOpen} onClose={() => setIsCreateWorkspaceModalOpen(false)} />

      {/* Create Project is available only inside a real Workspace. */}
      {currentWorkspace && !sharedMode && <CreateProjectModal
        key={currentWorkspace.id}
        open={isCreateProjectModalOpen}
        workspace={currentWorkspace}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />}
    </div>
  )
}

function AppSession() {
  const { currentUser, loading } = useUsers()
  if (loading) return <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Restoring your session...</div>
  if (!currentUser) return <AuthPage />
  return <WorkspaceProvider><AppContent /><IdentityDialog /></WorkspaceProvider>
}

export default function App() {
  return (
    <ThemeProvider>
      <UserProvider><AppSession /></UserProvider>
    </ThemeProvider>
  )
}
