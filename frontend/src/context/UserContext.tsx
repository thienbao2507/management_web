import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { ApiError, api, type ApiUser, type RegisterResponse, type UserPayload } from "@/services/api"

export type IdentityDialogMode = "login" | "register" | "verify" | "edit" | null

interface UserStore {
  usersById: Record<string, ApiUser>
  currentUser: ApiUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  ingestUsers: (users: ApiUser[]) => void
  login: (email: string, password: string) => Promise<ApiUser>
  register: (displayName: string, email: string, password: string) => Promise<RegisterResponse>
  verifyEmail: (token: string) => Promise<string>
  resendVerification: (email: string) => Promise<string>
  logout: () => Promise<void>
  saveProfile: (payload: Omit<UserPayload, "email">) => Promise<ApiUser>
  dialogMode: IdentityDialogMode
  openIdentity: (mode: IdentityDialogMode) => void
}

const UserContext = createContext<UserStore | null>(null)

function clearScopedPreferences() {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith("management_web_project_id:") || key?.startsWith("management_web_workspace_id:")) {
      localStorage.removeItem(key)
    }
  }
  localStorage.removeItem("management_web_user_id")
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [usersById, setUsers] = useState<Record<string, ApiUser>>({})
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)
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

  const clearIdentity = useCallback(() => {
    ++sequence.current
    controller.current?.abort()
    setCurrentUser(null)
    setUsers({})
    setError(null)
    clearScopedPreferences()
  }, [])

  const refresh = useCallback(async () => {
    const requestId = ++sequence.current
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setLoading(true)
    setError(null)
    try {
      const result = await api.getMe(abort.signal)
      if (abort.signal.aborted || requestId !== sequence.current) return
      setCurrentUser(result.user)
      setUsers({ [result.user.id]: result.user })
    } catch (failure) {
      if (abort.signal.aborted || requestId !== sequence.current) return
      if (failure instanceof ApiError && failure.status === 401) {
        setCurrentUser(null)
        setUsers({})
      } else {
        setCurrentUser(null)
        setUsers({})
        setError(failure instanceof Error ? failure.message : "Could not restore your session.")
      }
    } finally {
      if (requestId === sequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const unauthorized = () => clearIdentity()
    window.addEventListener("management-web:unauthorized", unauthorized)
    return () => {
      ++sequence.current
      controller.current?.abort()
      window.removeEventListener("management-web:unauthorized", unauthorized)
    }
  }, [clearIdentity, refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password)
    setCurrentUser(result.user)
    setUsers({ [result.user.id]: result.user })
    setError(null)
    return result.user
  }, [])

  const register = useCallback(
    (displayName: string, email: string, password: string) => api.register({ display_name: displayName, email, password }),
    [],
  )
  const verifyEmail = useCallback(async (token: string) => (await api.verifyEmail(token)).message, [])
  const resendVerification = useCallback(async (email: string) => (await api.resendVerification(email)).message, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      clearIdentity()
      openIdentity("login")
    }
  }, [clearIdentity])

  const saveProfile = useCallback(async (payload: Omit<UserPayload, "email">) => {
    if (!currentUser) throw new Error("Authentication required")
    const user = await api.updateUser(currentUser.id, payload)
    setCurrentUser(user)
    ingestUsers([user])
    return user
  }, [currentUser, ingestUsers])

  return <UserContext.Provider value={{ usersById, currentUser, loading, error, refresh, ingestUsers, login, register, verifyEmail, resendVerification, logout, saveProfile, dialogMode, openIdentity }}>{children}</UserContext.Provider>
}

export function useUsers() {
  const context = useContext(UserContext)
  if (!context) throw new Error("UserProvider is required")
  return context
}
