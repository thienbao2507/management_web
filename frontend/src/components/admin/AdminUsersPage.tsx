import React, { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, MessageSquareText, ShieldCheck, Users } from "lucide-react"

import { AdminFeedbackPanel } from "@/components/admin/AdminFeedbackPanel"
import { Button } from "@/components/ui/Button"
import { SearchInput } from "@/components/ui/Input"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { api, type ApiAdminUser, type FeedbackStatusCounts } from "@/services/api"


const PAGE_SIZE = 50
const ADMIN_TAB_KEY = "management_web_admin_tab"

interface AdminUsersPageProps {
  currentUserId: string
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

function formatLastLogin(value: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (elapsedSeconds < 60) return "Vừa xong"
  const minutes = Math.floor(elapsedSeconds / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

export const AdminUsersPage: React.FC<AdminUsersPageProps> = ({ currentUserId }) => {
  const [activeTab, setActiveTab] = useState<"users" | "feedback">(() => (
    localStorage.getItem(ADMIN_TAB_KEY) === "feedback" ? "feedback" : "users"
  ))
  const [newFeedbackCount, setNewFeedbackCount] = useState(0)
  const [users, setUsers] = useState<ApiAdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set())
  const requestSequence = useRef(0)

  const handleCountsChange = useCallback((counts: FeedbackStatusCounts) => {
    setNewFeedbackCount(counts.new)
  }, [])

  const selectTab = (tab: "users" | "feedback") => {
    setActiveTab(tab)
    localStorage.setItem(ADMIN_TAB_KEY, tab)
  }

  useEffect(() => {
    if (activeTab === "feedback") return
    const controller = new AbortController()
    api.listAdminFeedback({ page: 1, page_size: 1 }, controller.signal)
      .then((result) => setNewFeedbackCount(result.counts.new))
      .catch(() => undefined)
    return () => controller.abort()
  }, [activeTab])

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
      setError(reason instanceof Error ? reason.message : "Không thể tải danh sách người dùng.")
    }).finally(() => {
      window.clearTimeout(loadingTimer)
      if (sequence === requestSequence.current) setLoading(false)
    })
    return () => window.clearTimeout(loadingTimer)
  }, [debouncedSearch, page, refreshKey])

  const updateUser = async (
    user: ApiAdminUser,
    payload: { role?: "admin" | "user"; is_active?: boolean },
  ) => {
    if (pendingUserIds.has(user.id) || user.id === currentUserId) return
    setPendingUserIds((current) => new Set(current).add(user.id))
    setError(null)
    try {
      const updated = await api.updateAdminUser(user.id, payload)
      setUsers((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật người dùng này.")
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
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Quản trị</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeTab === "users"
                ? "Xem tài khoản, phân quyền và kiểm soát quyền truy cập."
                : "Xem góp ý của người dùng, cập nhật trạng thái và ghi chú nội bộ."}
            </p>
          </div>
          {activeTab === "users" && <div className="w-full sm:max-w-xs">
            <SearchInput
              aria-label="Tìm kiếm người dùng"
              placeholder="Tìm theo tên hoặc email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
          </div>}
        </div>

        <div role="tablist" aria-label="Các mục quản trị" className="mt-5 flex gap-1 border-b border-border">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "users"}
            onClick={() => selectTab("users")}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="h-3.5 w-3.5" /> Người dùng
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "feedback"}
            onClick={() => selectTab("feedback")}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${activeTab === "feedback" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <MessageSquareText className="h-3.5 w-3.5" /> Góp ý
            <span aria-label={`${newFeedbackCount} góp ý mới`} className="min-w-5 rounded-full bg-primary/15 px-1.5 py-0.5 text-center text-[9px] font-bold text-primary">{newFeedbackCount}</span>
          </button>
        </div>

        {activeTab === "users" ? <>
          <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {loading ? "Đang cập nhật..." : `${total} người dùng`}
          </span>
          </div>

        {error && (
          <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>Thử lại</Button>
          </div>
        )}

        {loading && users.length === 0 ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" /> Đang tải người dùng...
          </div>
        ) : !error && total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-6 w-6" /></span>
            <div>
              <h2 className="text-sm font-semibold">Không tìm thấy người dùng</h2>
              <p className="mt-1 text-xs text-muted-foreground">Thử tên hoặc email khác.</p>
            </div>
          </div>
        ) : users.length > 0 ? (
          <div className="mt-4 min-w-0 overflow-x-auto rounded-lg border border-border bg-card">
            <table aria-label="Quản lý người dùng" className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr className="h-9">
                  <th scope="col" className="px-4">Ảnh đại diện + Tên</th>
                  <th scope="col" className="px-3">Email</th>
                  <th scope="col" className="w-32 px-3">Vai trò</th>
                  <th scope="col" className="w-32 px-3">Trạng thái</th>
                  <th scope="col" className="w-36 px-4">Ngày tạo</th>
                  <th scope="col" className="w-36 px-4">Đăng nhập gần nhất</th>
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
                            {user.display_name}{isCurrentUser && <span className="ml-1 font-normal text-primary">(bạn)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 text-xs text-muted-foreground">{user.email || "—"}</td>
                      <td className="px-3">
                        <select
                          aria-label={`Vai trò của ${user.display_name}`}
                          value={user.role}
                          disabled={isCurrentUser || pending}
                          onChange={(event) => void updateUser(user, { role: event.target.value as "admin" | "user" })}
                          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs capitalize shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="admin">Quản trị viên</option>
                          <option value="user">Người dùng</option>
                        </select>
                      </td>
                      <td className="px-3">
                        <button
                          type="button"
                          aria-label={`${user.is_active ? "Khoá" : "Kích hoạt"} ${user.display_name}`}
                          disabled={isCurrentUser || pending}
                          onClick={() => void updateUser(user, { is_active: !user.is_active })}
                          className={`inline-flex h-8 w-full items-center justify-center rounded-md border px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${user.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"}`}
                        >
                          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.is_active ? "Hoạt động" : "Đã khoá"}
                        </button>
                      </td>
                      <td className="px-4 text-[11px] text-muted-foreground">
                        <time dateTime={user.created_at}>{formatCreatedAt(user.created_at)}</time>
                      </td>
                      <td className="px-4 text-[11px] text-muted-foreground">
                        {user.last_login_at ? (
                          <time dateTime={user.last_login_at} title={new Date(user.last_login_at).toLocaleString("vi-VN")}>
                            {formatLastLogin(user.last_login_at)}
                          </time>
                        ) : <span className="text-muted-foreground/60">Chưa bao giờ</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {total > PAGE_SIZE && !error && (
          <nav aria-label="Phân trang người dùng" className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-[11px] text-muted-foreground">Trang {page} / {pages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="gap-1"><ChevronLeft className="h-3.5 w-3.5" /> Trước</Button>
              <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="gap-1">Sau <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </nav>
        )}
        </> : <AdminFeedbackPanel onCountsChange={handleCountsChange} />}
      </div>
    </div>
  )
}
