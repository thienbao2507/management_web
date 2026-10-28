import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { api, type ApiWorkspace, type WorkspacePayload } from "@/services/api"
import { useUsers } from "./UserContext"

interface WorkspaceStore {
  workspace: ApiWorkspace | null
  loading: boolean
  error: string | null
  scopeKey: string
  refresh: () => Promise<void>
  createWorkspace: (payload: WorkspacePayload) => Promise<ApiWorkspace>
}

const WorkspaceContext = createContext<WorkspaceStore | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, loading: userLoading } = useUsers()
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const activeUserId = useRef<string | null>(currentUser?.id || null)
  useLayoutEffect(() => { activeUserId.current = currentUser?.id || null }, [currentUser?.id])

  const refresh = useCallback(async () => {
    const userId = currentUser?.id
    const requestId = ++sequence.current
    controller.current?.abort()
    if (!userId) {
      setWorkspace(null)
      setLoading(false)
      setError(null)
      return
    }

    const abort = new AbortController()
    controller.current = abort
    setLoading(true)
    setError(null)
    try {
      const items = await api.getWorkspaces(abort.signal)
      if (abort.signal.aborted || requestId !== sequence.current || activeUserId.current !== userId) return
      const savedId = localStorage.getItem(`management_web_workspace_id:${userId}`)
      const selected = items.find((item) => item.id === savedId) || items[0] || null
      setWorkspace(selected)
      if (selected) localStorage.setItem(`management_web_workspace_id:${userId}`, selected.id)
      else localStorage.removeItem(`management_web_workspace_id:${userId}`)
    } catch (failure) {
      if (abort.signal.aborted || requestId !== sequence.current) return
      setWorkspace(null)
      setError(failure instanceof Error ? failure.message : "Could not load personal Workspace")
    } finally {
      if (!abort.signal.aborted && requestId === sequence.current) setLoading(false)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!userLoading) void refresh()
    const activeController = controller.current
    return () => { ++sequence.current; activeController?.abort() }
  }, [refresh, userLoading])

  const createWorkspace = useCallback(async (payload: WorkspacePayload) => {
    const userId = currentUser?.id
    if (!userId) throw new Error("Sign in before creating a Workspace")
    const created = await api.createWorkspace(payload)
    if (activeUserId.current === userId) {
      localStorage.setItem(`management_web_workspace_id:${userId}`, created.id)
      setWorkspace(created)
      setError(null)
    }
    return created
  }, [currentUser?.id])

  const scopeKey = useMemo(
    () => JSON.stringify([currentUser?.id || "neutral", workspace?.id || "no-workspace"]),
    [currentUser?.id, workspace?.id]
  )

  return (
    <WorkspaceContext.Provider value={{ workspace, loading, error, scopeKey, refresh, createWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error("WorkspaceProvider is required")
  return context
}
