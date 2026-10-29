export interface ApiSubtask {
  id: string
  task_id: string
  title: string
  is_completed: boolean
  position: number
  created_at: string
}

export interface ApiTask {
  id: string
  project_id: string
  sprint_id?: string | null
  assignee_id?: string | null
  assignee?: ApiUser | null
  task_key: string
  title: string
  description?: string | null
  category: string
  status: "backlog" | "todo" | "in_progress" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  position: number
  assignee_name?: string | null
  assignee_avatar?: string | null
  assignee_initials?: string | null
  assignee_email?: string | null
  due_date?: string | null
  start_date?: string | null
  weight: number
  is_blocked: boolean
  blocker_reason?: string | null
  thumbnail?: string | null
  created_at: string
  updated_at: string
  subtasks: ApiSubtask[]
}

export type AvatarKey = "owl" | "fish" | "cat" | "panda" | "hedgehog" | "robot"
export interface ApiUser {
  id: string
  display_name: string
  email: string | null
  job_title: string | null
  default_avatar_key: AvatarKey
  custom_avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
export interface UserPayload { display_name: string; email?: string | null; job_title?: string | null; custom_avatar_url?: string | null }
export interface ApiMember { project_id: string; user_id: string; created_at: string; user: ApiUser }
export interface ApiSprint { id: string; project_id: string; name: string; status: string; goal: string | null; start_date: string | null; end_date: string | null; created_at: string }
export interface UserListResponse { items: ApiUser[]; total: number; page: number; page_size: number }
export interface AuthSessionResponse { user: ApiUser; csrf_header: string; authenticated?: boolean }
export interface RegisterResponse { status: "pending_verification" | "completed"; message: string; email_delivery?: "sent" | "failed" | "not_configured" }
export interface AuthStatus { ready: boolean; registration_available: boolean; message: string | null }

export interface ApiWorkspace {
  id: string
  owner_user_id: string
  name: string
  description: string | null
  workspace_type: "personal"
  created_at: string
  updated_at: string
}

export interface WorkspacePayload {
  name: string
  description?: string | null
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export interface ApiProject {
  id: string
  workspace_id?: string | null
  key: string
  name: string
  description?: string | null
  status: string
  priority: string
  start_date?: string | null
  due_date?: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
  tasks_count?: number
}

export const RESOURCE_TYPES = [
  "Website",
  "Google Docs",
  "Google Sheets",
  "Google Drive",
  "Canva",
  "Word",
  "GitHub",
  "Other",
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

export interface ApiResource {
  id: string
  project_id: string
  project_name: string
  title: string
  url: string
  resource_type: ResourceType
  description?: string | null
  keywords: string[]
  created_at: string
  updated_at: string
}

export interface ResourceListResponse {
  items: ApiResource[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface ResourcePayload {
  project_id: string
  title: string
  url: string
  resource_type: ResourceType
  description?: string | null
  keywords: string[]
}

export interface ResourceListParams {
  q?: string
  project_id?: string
  workspace_id?: string
  unassigned?: boolean
  shared?: boolean
  resource_type?: ResourceType
  created_from?: string
  created_to?: string
  page?: number
  page_size?: number
}

const API_BASE = "/api/v1"

function cookieValue(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`
  const entry = document.cookie.split("; ").find((value) => value.startsWith(prefix))
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase()
  const csrfToken = !["GET", "HEAD", "OPTIONS"].includes(method) ? cookieValue("mw_csrf") : null
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Management-Web-Request": "1",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options?.headers || {}),
    },
  })

  if (!res.ok) {
    if (res.status === 401 && url !== "/auth/me" && url !== "/auth/login") {
      window.dispatchEvent(new Event("management-web:unauthorized"))
    }
    if (res.status === 502) {
      throw new Error(
        "Backend FastAPI chưa được bật tại port 8000 (502 Bad Gateway). Hãy chạy backend trong terminal để kết nối Neon."
      )
    }
    let errorDetail = "An unexpected error occurred"
    try {
      const errorJson = await res.json()
      if (typeof errorJson.detail === "string") {
        errorDetail = errorJson.detail
      } else if (Array.isArray(errorJson.detail)) {
        errorDetail = errorJson.detail
          .map((item: { msg?: string }) => item.msg || "Invalid value")
          .join("; ")
      }
    } catch {
      errorDetail = res.statusText || `Error HTTP ${res.status}`
    }
    throw new ApiError(errorDetail, res.status)
  }

  return res.json()
}

export const api = {
  getAuthStatus(signal?: AbortSignal): Promise<AuthStatus> { return request("/auth/status", { signal }) },
  getMe(signal?: AbortSignal): Promise<AuthSessionResponse> { return request("/auth/me", { signal }) },
  register(payload: { display_name: string; email: string; password: string }): Promise<RegisterResponse> {
    return request("/auth/register", { method: "POST", body: JSON.stringify(payload) })
  },
  verifyEmail(token: string): Promise<{ message: string }> {
    return request("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
  },
  resendVerification(email: string): Promise<{ message: string }> {
    return request("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) })
  },
  login(email: string, password: string): Promise<AuthSessionResponse> {
    return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
  },
  logout(): Promise<{ message: string }> { return request("/auth/logout", { method: "POST", body: "{}" }) },
  getUser(id: string, signal?: AbortSignal): Promise<ApiUser> { return request(`/users/${encodeURIComponent(id)}`, { signal }) },
  updateUser(id: string, payload: Omit<Partial<UserPayload>, "email">): Promise<ApiUser> { return request(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }) },
  getMembers(projectId: string, signal?: AbortSignal): Promise<ApiMember[]> { return request(`/projects/${encodeURIComponent(projectId)}/members`, { signal }) },
  addMember(projectId: string, email: string): Promise<ApiMember> { return request(`/projects/${encodeURIComponent(projectId)}/members`, { method: "POST", body: JSON.stringify({ email }) }) },
  removeMember(projectId: string, userId: string): Promise<{ message: string }> { return request(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }) },
  getSprints(projectId: string, signal?: AbortSignal): Promise<ApiSprint[]> { return request(`/projects/${encodeURIComponent(projectId)}/sprints`, { signal }) },
  getWorkspaces(signal?: AbortSignal): Promise<ApiWorkspace[]> {
    return request("/workspaces", { signal })
  },
  createWorkspace(payload: WorkspacePayload): Promise<ApiWorkspace> {
    return request("/workspaces", { method: "POST", body: JSON.stringify(payload) })
  },
  // Projects
  async getProjects(
    includeArchived = false,
    signal?: AbortSignal,
    scope?: { workspace_id?: string; unassigned?: boolean; shared?: boolean }
  ): Promise<ApiProject[]> {
    const query = new URLSearchParams({ include_archived: String(includeArchived) })
    if (scope?.workspace_id) query.set("workspace_id", scope.workspace_id)
    if (scope?.unassigned) query.set("unassigned", "true")
    if (scope?.shared) query.set("shared", "true")
    return request<ApiProject[]>(`/projects?${query.toString()}`, { signal })
  },

  async createProject(payload: {
    name: string
    key?: string
    description?: string
    priority?: string
    workspace_id?: string
  }): Promise<ApiProject> {
    return request<ApiProject>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  async updateProject(
    id: string,
    payload: Partial<ApiProject>
  ): Promise<ApiProject> {
    return request<ApiProject>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  },

  async archiveProject(id: string): Promise<{ message: string; id: string }> {
    return request<{ message: string; id: string }>(`/projects/${id}`, {
      method: "DELETE",
    })
  },

  // Tasks
  async getTasks(projectId: string, search?: string, signal?: AbortSignal, sprintId?: string, unsprinted = false): Promise<ApiTask[]> {
    const url = `/tasks?project_id=${encodeURIComponent(projectId)}${
      search ? `&search=${encodeURIComponent(search)}` : ""
    }`
    return request<ApiTask[]>(url + (sprintId ? `&sprint_id=${encodeURIComponent(sprintId)}` : "") + (unsprinted ? "&unsprinted=true" : ""), { signal })
  },

  async createTask(payload: {
    project_id: string
    sprint_id?: string | null
    assignee_id?: string | null
    title: string
    description?: string
    category?: string
    status?: string
    priority?: string
    due_date?: string
    assignee_name?: string
    assignee_avatar?: string
    assignee_initials?: string
    subtask_titles?: string[]
  }): Promise<ApiTask> {
    return request<ApiTask>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  async updateTask(
    id: string,
    payload: Partial<{
      title: string
      assignee_id: string | null
      sprint_id: string | null
      description: string
      category: string
      status: string
      priority: string
      position: number
      due_date: string
      is_blocked: boolean
      blocker_reason: string
      assignee_name: string
      assignee_avatar: string
      assignee_initials: string
    }>
  ): Promise<ApiTask> {
    return request<ApiTask>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  },

  async deleteTask(id: string): Promise<{ message: string; id: string }> {
    return request<{ message: string; id: string }>(`/tasks/${id}`, {
      method: "DELETE",
    })
  },

  async reorderTask(
    id: string,
    status: string,
    position: number,
    sprintId?: string,
    unsprinted = false
  ): Promise<ApiTask> {
    return request<ApiTask>(`/tasks/${id}/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ status, position, sprint_id: sprintId, unsprinted }),
    })
  },

  // Subtasks
  async addSubtask(taskId: string, title: string): Promise<ApiSubtask> {
    return request<ApiSubtask>(`/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title, is_completed: false }),
    })
  },

  async toggleSubtask(
    taskId: string,
    subtaskId: string,
    isCompleted: boolean
  ): Promise<ApiSubtask> {
    return request<ApiSubtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_completed: isCompleted }),
    })
  },

  async deleteSubtask(
    taskId: string,
    subtaskId: string
  ): Promise<{ message: string; id: string }> {
    return request<{ message: string; id: string }>(
      `/tasks/${taskId}/subtasks/${subtaskId}`,
      {
        method: "DELETE",
      }
    )
  },

  // Project resources
  async getResources(
    params: ResourceListParams,
    signal?: AbortSignal
  ): Promise<ResourceListResponse> {
    const query = new URLSearchParams()
    if (params.q) query.set("q", params.q)
    if (params.project_id) query.set("project_id", params.project_id)
    if (params.workspace_id) query.set("workspace_id", params.workspace_id)
    if (params.unassigned) query.set("unassigned", "true")
    if (params.shared) query.set("shared", "true")
    if (params.resource_type) query.set("resource_type", params.resource_type)
    if (params.created_from) query.set("created_from", params.created_from)
    if (params.created_to) query.set("created_to", params.created_to)
    query.set("page", String(params.page || 1))
    query.set("page_size", String(params.page_size || 20))
    return request<ResourceListResponse>(`/resources?${query.toString()}`, { signal })
  },

  async getResource(id: string): Promise<ApiResource> {
    return request<ApiResource>(`/resources/${encodeURIComponent(id)}`)
  },

  async createResource(payload: ResourcePayload): Promise<ApiResource> {
    return request<ApiResource>("/resources", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  async updateResource(
    id: string,
    payload: Partial<ResourcePayload>
  ): Promise<ApiResource> {
    return request<ApiResource>(`/resources/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  },

  async deleteResource(id: string): Promise<{ message: string; id: string }> {
    return request<{ message: string; id: string }>(
      `/resources/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    )
  },
}
