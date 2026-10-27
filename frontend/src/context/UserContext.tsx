import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { api, type ApiUser, type UserPayload } from "@/services/api"

const USER_PREFERENCE = "management_web_user_id"
type IdentityDialogMode = "select" | "create" | "edit" | null
interface UserStore {
  usersById: Record<string, ApiUser>
  currentUser: ApiUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  selectUser: (id: string | null) => void
  ingestUsers: (users: ApiUser[]) => void
  saveProfile: (payload: UserPayload, id?: string) => Promise<ApiUser>
  dialogMode: IdentityDialogMode
  openIdentity: (mode: IdentityDialogMode) => void
}
const UserContext = createContext<UserStore | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [usersById, setUsers] = useState<Record<string, ApiUser>>({})
  const [currentId, setCurrentId] = useState<string | null>(() => localStorage.getItem(USER_PREFERENCE))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogMode, openIdentity] = useState<IdentityDialogMode>(null)
  const sequence = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const ingestUsers = useCallback((items: ApiUser[]) => setUsers((previous) => {
    const next = { ...previous }
    for (const item of items) {
      if (!next[item.id] || Date.parse(item.updated_at) >= Date.parse(next[item.id].updated_at)) next[item.id] = item
    }
    return next
  }), [])
  const selectUser = useCallback((id: string | null) => {
    setCurrentId(id)
    if (id) localStorage.setItem(USER_PREFERENCE, id)
    else localStorage.removeItem(USER_PREFERENCE)
  }, [])
  const refresh = useCallback(async () => {
    const requestId = ++sequence.current
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setLoading(true)
    setError(null)
    try {
      const items: ApiUser[] = []
      let page = 1
      while (true) {
        const result = await api.getUsers(page++, abort.signal)
        items.push(...result.items)
        if (items.length >= result.total || !result.items.length) break
      }
      if (requestId !== sequence.current) return
      setUsers(Object.fromEntries(items.map((user) => [user.id, user])))
      const saved = localStorage.getItem(USER_PREFERENCE)
      if (saved && !items.some((user) => user.id === saved && user.is_active)) selectUser(null)
    } catch (failure) {
      if (!abort.signal.aborted && requestId === sequence.current) {
        setError(failure instanceof Error ? failure.message : "Could not load workspace identities.")
        setUsers({})
      }
    } finally {
      if (requestId === sequence.current) setLoading(false)
    }
  }, [selectUser])
  useEffect(() => { void refresh(); return () => { ++sequence.current; controller.current?.abort() } }, [refresh])
  const saveProfile = useCallback(async (payload: UserPayload, id?: string) => {
    const user = id ? await api.updateUser(id, payload) : await api.createUser(payload)
    ingestUsers([user])
    if (!id) selectUser(user.id)
    return user
  }, [ingestUsers, selectUser])
  const candidate = currentId ? usersById[currentId] : null
  const currentUser = !loading && !error && candidate?.is_active ? candidate : null
  return <UserContext.Provider value={{ usersById, currentUser, loading, error, refresh, selectUser, ingestUsers, saveProfile, dialogMode, openIdentity }}>{children}</UserContext.Provider>
}

export function useUsers() {
  const context = useContext(UserContext)
  if (!context) throw new Error("UserProvider is required")
  return context
}
