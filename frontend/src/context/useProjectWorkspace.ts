import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { api, type ApiMember, type ApiSprint, type ApiTask } from "@/services/api"
import { useUsers } from "./UserContext"

export interface WorkspaceToken { key: string }
interface WorkspaceState {
  token: WorkspaceToken | null
  tasks: ApiTask[]; members: ApiMember[]; sprints: ApiSprint[]
  tasksLoading: boolean; membersLoading: boolean; sprintsLoading: boolean
  tasksError: string | null; membersError: string | null; sprintsError: string | null
}
const empty: WorkspaceState = { token: null, tasks: [], members: [], sprints: [], tasksLoading: true, membersLoading: true, sprintsLoading: true, tasksError: null, membersError: null, sprintsError: null }

export function useProjectWorkspace(projectId: string | undefined, identityId: string | undefined, sprintFilter: string, parentScopeKey: string) {
  const { ingestUsers, usersById } = useUsers()
  const key = JSON.stringify([identityId || "neutral", parentScopeKey, projectId, sprintFilter])
  const token = useMemo<WorkspaceToken>(() => ({ key }), [key])
  const current = useRef(token)
  useLayoutEffect(() => { current.current = token }, [token])
  const [state, setState] = useState<WorkspaceState>(empty)
  const [revision, setRevision] = useState(0)
  const isCurrent = useCallback((candidate: WorkspaceToken) => current.current === candidate, [])
  const refresh = useCallback(() => { if (current.current === token) setRevision((value) => value + 1) }, [token])
  const mutateTasks = useCallback((update: (tasks: ApiTask[]) => ApiTask[]) => {
    if (current.current !== token) return
    setState((previous) => previous.token === token ? { ...previous, tasks: update(previous.tasks) } : previous)
  }, [token])
  useEffect(() => {
    const controller = new AbortController()
    if (!projectId) return
    setState({ ...empty, token })
    const accept = (update: Partial<WorkspaceState>) => {
      if (controller.signal.aborted || current.current !== token) return
      setState((previous) => previous.token === token ? { ...previous, ...update } : previous)
    }
    const errorText = (failure: unknown) => failure instanceof Error ? failure.message : "Could not load project data"
    void api.getTasks(projectId, undefined, controller.signal, !["all", "unsprinted"].includes(sprintFilter) ? sprintFilter : undefined, sprintFilter === "unsprinted").then((tasks) => {
      if (controller.signal.aborted || current.current !== token) return
      ingestUsers(tasks.flatMap((task) => task.assignee ? [task.assignee] : []))
      accept({ tasks, tasksLoading: false })
    }).catch((failure) => accept({ tasks: [], tasksError: errorText(failure), tasksLoading: false }))
    void api.getMembers(projectId, controller.signal).then((members) => {
      if (controller.signal.aborted || current.current !== token) return
      ingestUsers(members.map((member) => member.user))
      accept({ members, membersLoading: false })
    }).catch((failure) => accept({ members: [], membersError: errorText(failure), membersLoading: false }))
    void api.getSprints(projectId, controller.signal).then((sprints) => accept({ sprints, sprintsLoading: false })).catch((failure) => accept({ sprints: [], sprintsError: errorText(failure), sprintsLoading: false }))
    return () => controller.abort()
  }, [projectId, sprintFilter, token, revision, ingestUsers])
  const visible = state.token === token ? state : { ...empty, tasksLoading: Boolean(projectId), membersLoading: Boolean(projectId), sprintsLoading: Boolean(projectId) }
  return { ...visible, members: visible.members.map((member) => ({ ...member, user: usersById[member.user_id] || member.user })), token, isCurrent, mutateTasks, refresh }
}
