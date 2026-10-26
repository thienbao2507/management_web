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

export interface ApiProject {
  id: string
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

const API_BASE = "/api/v1"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    let errorDetail = "An unexpected error occurred"
    try {
      const errorJson = await res.json()
      errorDetail = errorJson.detail || errorDetail
    } catch {
      errorDetail = res.statusText
    }
    throw new Error(errorDetail)
  }

  return res.json()
}

export const api = {
  // Projects
  async getProjects(includeArchived = false): Promise<ApiProject[]> {
    return request<ApiProject[]>(`/projects?include_archived=${includeArchived}`)
  },

  async createProject(payload: {
    name: string
    key?: string
    description?: string
    priority?: string
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
  async getTasks(projectId: string, search?: string): Promise<ApiTask[]> {
    const url = `/tasks?project_id=${encodeURIComponent(projectId)}${
      search ? `&search=${encodeURIComponent(search)}` : ""
    }`
    return request<ApiTask[]>(url)
  },

  async createTask(payload: {
    project_id: string
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
    position: number
  ): Promise<ApiTask> {
    return request<ApiTask>(`/tasks/${id}/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ status, position }),
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
}
