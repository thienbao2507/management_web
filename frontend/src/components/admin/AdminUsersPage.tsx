import React, { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, ShieldCheck, Users } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { SearchInput } from "@/components/ui/Input"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { api, type ApiUser } from "@/services/api"


const PAGE_SIZE = 50

interface AdminUsersPageProps {
  currentUserId: string
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ currentUserId }) => {
  const [users, setUsers] = useState<ApiUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set())
  const requestSequence = useRef(0)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    const sequence = ++requestSequence.current
    const loadingTimer = window.setTimeout(() => {
      if (sequence !== requestSequence.current) return
      setLoading(true)
      setError(null)
    }, 0)
    api.listAdminUsers({
      page,
      page_size: PAGE_SIZE,
      q: debouncedSearch || undefined,
    }).then((result) => {
      if (sequence !== requestSequence.current) return
      setUsers(result.items)
      setTotal(result.total)
      const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
      if (page > lastPage) setPage(lastPage)
    }).catch((reason: unknown) => {
      if (sequence !== requestSequence.current) return
      setUsers([])
      setTotal(0)
      setError(reason instanceof Error ? reason.message : "Unable to load users.")
    }).finally(() => {
      window.clearTimeout(loadingTimer)
      if (sequence === requestSequence.current) setLoading(false)
    })
    return () => window.clearTimeout(loadingTimer)
  }, [debouncedSearch, page, refreshKey])

  const updateUser = async (
    user: ApiUser,
    payload: { role?: "admin" | "user"; is_active?: boolean },
  ) => {
    if (pendingUserIds.has(user.id) || user.id === currentUserId) return
    setPendingUserIds((current) => new Set(current).add(user.id))
    setError(null)
    try {
      const updated = await api.updateAdminUser(user.id, payload)
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to update this user.")
    } finally {
      setPendingUserIds((current) => {
        const next = new Set(current)
        next.delete(user.id)
        return next
      })
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Manage users</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Review accounts, assign roles, and control account access.</p>
          </div>
          <div className="w-full sm:max-w-xs">
            <SearchInput
              aria-label="Search users"
              placeholder="Search name or email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {loading ? "Updating users..." : `${total} user${total === 1 ? "" : "s"}`}
          </span>
        </div>

        {error && (
          <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>Retry</Button>
          </div>
        )}

        {loading && users.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading users...
          </div>
        ) : !error && total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-6 w-6" /></span>
            <div>
              <h2 className="text-sm font-semibold">No users found</h2>
              <p className="mt-1 text-xs text-muted-foreground">Try a different name or email.</p>
            </div>
          </div>
        ) : users.length > 0 ? (
          <div className="mt-4 min-w-0 overflow-x-auto rounded-lg border border-border bg-card">
            <table aria-label="Manage users" className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr className="h-9">
                  <th scope="col" className="px-4">Avatar + Name</th>
                  <th scope="col" className="px-3">Email</th>
                  <th scope="col" className="w-32 px-3">Role</th>
                  <th scope="col" className="w-32 px-3">Status</th>
                  <th scope="col" className="w-36 px-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUserId
                  const pending = pendingUserIds.has(user.id)
                  return (
                    <tr key={user.id} className="h-16 border-t border-border/60 transition-colors hover:bg-muted/40">
                      <td className="px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar user={user} size="sm" />
                          <span className="min-w-0 truncate text-xs font-semibold">
                            {user.display_name}{isCurrentUser && <span className="ml-1 font-normal text-primary">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 text-xs text-muted-foreground">{user.email || "—"}</td>
                      <td className="px-3">
                        <select
                          aria-label={`Role for ${user.display_name}`}
                          value={user.role}
                          disabled={isCurrentUser || pending}
                          onChange={(event) => void updateUser(user, { role: event.target.value as "admin" | "user" })}
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs capitalize shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="admin">Admin</option>
                          <option value="user">User</option>
                        </select>
                      </td>
                      <td className="px-3">
                        <button
                          type="button"
                          aria-label={`${user.is_active ? "Lock" : "Activate"} ${user.display_name}`}
                          disabled={isCurrentUser || pending}
                          onClick={() => void updateUser(user, { is_active: !user.is_active })}
                          className={`inline-flex h-8 w-full items-center justify-center rounded-md border px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${user.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"}`}
                        >
                          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.is_active ? "Active" : "Locked"}
                        </button>
                      </td>
                      <td className="px-4 text-[11px] text-muted-foreground">
                        <time dateTime={user.created_at}>{formatCreatedAt(user.created_at)}</time>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {total > PAGE_SIZE && !error && (
          <nav aria-label="User pagination" className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-[11px] text-muted-foreground">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="gap-1"><ChevronLeft className="h-3.5 w-3.5" /> Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="gap-1">Next <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
