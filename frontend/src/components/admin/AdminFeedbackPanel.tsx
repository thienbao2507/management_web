import React, { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Image, Loader2, MessageSquareText } from "lucide-react"

import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { SearchInput } from "@/components/ui/Input"
import { api, type AdminFeedbackDetail, type AdminFeedbackSummary, type FeedbackCategory, type FeedbackStatus, type FeedbackStatusCounts } from "@/services/api"


const PAGE_SIZE = 20

const EMPTY_COUNTS: FeedbackStatusCounts = {
  new: 0,
  in_progress: 0,
  done: 0,
  rejected: 0,
}

const STATUS_OPTIONS: Array<{ value: FeedbackStatus; label: string }> = [
  { value: "new", label: "Mới" },
  { value: "in_progress", label: "Đang xử lý" },
  { value: "done", label: "Hoàn thành" },
  { value: "rejected", label: "Từ chối" },
]

const statusClasses: Record<FeedbackStatus, string> = {
  new: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Lỗi",
  feature: "Tính năng",
  other: "Khác",
}

const categoryClasses: Record<FeedbackCategory, string> = {
  bug: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  feature: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  other: "border-border bg-muted text-muted-foreground",
}

interface AdminFeedbackPanelProps {
  onCountsChange?: (counts: FeedbackStatusCounts) => void
}

function statusLabel(status: FeedbackStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?"
}

export const AdminFeedbackPanel: React.FC<AdminFeedbackPanelProps> = ({ onCountsChange }) => {
  const [items, setItems] = useState<AdminFeedbackSummary[]>([])
  const [counts, setCounts] = useState<FeedbackStatusCounts>(EMPTY_COUNTS)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<FeedbackStatus | "">("")
  const [category, setCategory] = useState<FeedbackCategory | "">("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const requestSequence = useRef(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [detail, setDetail] = useState<AdminFeedbackDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [statusDraft, setStatusDraft] = useState<FeedbackStatus>("new")
  const [noteDraft, setNoteDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [rowSavingId, setRowSavingId] = useState<string | null>(null)
  const detailSequence = useRef(0)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    const sequence = ++requestSequence.current
    const controller = new AbortController()
    const loadingTimer = window.setTimeout(() => {
      if (sequence !== requestSequence.current) return
      setLoading(true)
      setError(null)
    }, 0)
    api.listAdminFeedback({
      status: status || undefined,
      category: category || undefined,
      q: debouncedSearch || undefined,
      page,
      page_size: PAGE_SIZE,
    }, controller.signal).then((result) => {
      if (sequence !== requestSequence.current) return
      setItems(result.items)
      setTotal(result.total)
      setCounts(result.counts)
      onCountsChange?.(result.counts)
      const lastPage = Math.max(1, Math.ceil(result.total / result.page_size))
      if (page > lastPage) setPage(lastPage)
    }).catch((reason: unknown) => {
      if (controller.signal.aborted || sequence !== requestSequence.current) return
      setItems([])
      setTotal(0)
      setError(reason instanceof Error ? reason.message : "Không thể tải góp ý.")
    }).finally(() => {
      window.clearTimeout(loadingTimer)
      if (sequence === requestSequence.current) setLoading(false)
    })
    return () => {
      window.clearTimeout(loadingTimer)
      controller.abort()
    }
  }, [category, debouncedSearch, onCountsChange, page, refreshKey, status])

  const openDetail = (item: AdminFeedbackSummary) => {
    const sequence = ++detailSequence.current
    setDialogOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    api.getAdminFeedback(item.id).then((result) => {
      if (sequence !== detailSequence.current) return
      setDetail(result)
      setStatusDraft(result.status)
      setNoteDraft(result.admin_note || "")
    }).catch((reason: unknown) => {
      if (sequence !== detailSequence.current) return
      setDetailError(reason instanceof Error ? reason.message : "Không thể tải chi tiết góp ý.")
    }).finally(() => {
      if (sequence === detailSequence.current) setDetailLoading(false)
    })
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && saving) return
    setDialogOpen(open)
    if (!open) {
      detailSequence.current += 1
      setDetail(null)
      setDetailError(null)
    }
  }

  const dirty = Boolean(detail) && (
    statusDraft !== detail?.status || noteDraft !== (detail?.admin_note || "")
  )

  const saveDetail = async () => {
    if (!detail || !dirty || saving) return
    const previousStatus = detail.status
    const payload: { status?: FeedbackStatus; admin_note?: string | null } = {}
    if (statusDraft !== detail.status) payload.status = statusDraft
    if (noteDraft !== (detail.admin_note || "")) payload.admin_note = noteDraft
    setSaving(true)
    setDetailError(null)
    try {
      const updated = await api.updateAdminFeedback(detail.id, payload)
      setDetail(updated)
      setStatusDraft(updated.status)
      setNoteDraft(updated.admin_note || "")
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
      if (previousStatus !== updated.status) {
        const nextCounts = {
          ...counts,
          [previousStatus]: Math.max(0, counts[previousStatus] - 1),
          [updated.status]: counts[updated.status] + 1,
        }
        setCounts(nextCounts)
        onCountsChange?.(nextCounts)
      }
      setRefreshKey((value) => value + 1)
    } catch (reason: unknown) {
      setDetailError(reason instanceof Error ? reason.message : "Không thể lưu góp ý.")
    } finally {
      setSaving(false)
    }
  }

  const updateRowStatus = async (item: AdminFeedbackSummary, nextStatus: FeedbackStatus) => {
    if (item.status === nextStatus || rowSavingId) return
    setRowSavingId(item.id)
    setError(null)
    try {
      const updated = await api.updateAdminFeedback(item.id, { status: nextStatus })
      setItems((current) => current.map((row) => row.id === updated.id ? updated : row))
      if (item.status !== updated.status) {
        const nextCounts = {
          ...counts,
          [item.status]: Math.max(0, counts[item.status] - 1),
          [updated.status]: counts[updated.status] + 1,
        }
        setCounts(nextCounts)
        onCountsChange?.(nextCounts)
      }
      setRefreshKey((value) => value + 1)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật trạng thái.")
    } finally {
      setRowSavingId(null)
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const allCount = counts.new + counts.in_progress + counts.done + counts.rejected

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div role="group" aria-label="Lọc góp ý theo trạng thái" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!status}
            onClick={() => { setStatus(""); setPage(1) }}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${!status ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Tất cả <span className="ml-1 opacity-70">{allCount}</span>
          </button>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={status === option.value}
              onClick={() => { setStatus(option.value); setPage(1) }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${status === option.value ? statusClasses[option.value] : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {option.label} <span className="ml-1 opacity-70">{counts[option.value]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            aria-label="Lọc theo phân loại"
            value={category}
            onChange={(event) => { setCategory(event.target.value as FeedbackCategory | ""); setPage(1) }}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Tất cả phân loại</option>
            <option value="bug">Lỗi</option>
            <option value="feature">Tính năng</option>
            <option value="other">Khác</option>
          </select>
          <div className="w-full sm:w-72">
            <SearchInput
              aria-label="Tìm kiếm góp ý"
              placeholder="Tìm theo nội dung, người gửi hoặc email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>Thử lại</Button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" /> Đang tải góp ý...
        </div>
      ) : !error && items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageSquareText className="h-6 w-6" /></span>
          <div>
            <h2 className="text-sm font-semibold">Không tìm thấy góp ý</h2>
            <p className="mt-1 text-xs text-muted-foreground">Thử đổi trạng thái, phân loại hoặc từ khoá tìm kiếm.</p>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="mt-4 min-w-0 overflow-x-auto rounded-lg border border-border bg-card">
          <table aria-label="Góp ý gửi tới quản trị" className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr className="h-9">
                <th scope="col" className="px-4">Người gửi</th>
                <th scope="col" className="w-28 px-3">Phân loại</th>
                <th scope="col" className="px-3">Nội dung</th>
                <th scope="col" className="w-20 px-3">Hình ảnh</th>
                <th scope="col" className="w-32 px-3">Trạng thái</th>
                <th scope="col" className="w-32 px-4">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  tabIndex={0}
                  onClick={() => openDetail(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openDetail(item)
                    }
                  }}
                  className="h-16 cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <td className="px-4">
                    {item.user ? (
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{initials(item.user.display_name)}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">{item.user.display_name}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">{item.user.email}</span>
                        </span>
                      </div>
                    ) : <span className="text-xs italic text-muted-foreground">Người dùng đã xoá</span>}
                  </td>
                  <td className="px-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${categoryClasses[item.category]}`}>{CATEGORY_LABELS[item.category]}</span>
                  </td>
                  <td className="max-w-md px-3 text-xs"><span className="line-clamp-2 whitespace-pre-line">{item.content}</span></td>
                  <td className="px-3 text-[11px] text-muted-foreground">
                    {item.image_count > 0 ? <span className="inline-flex items-center gap-1"><Image className="h-3.5 w-3.5" />{item.image_count}</span> : <span aria-label="Không có hình ảnh">—</span>}
                  </td>
                  <td className="px-3" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={`Đổi trạng thái, hiện tại: ${statusLabel(item.status)}`}
                        value={item.status}
                        disabled={rowSavingId !== null}
                        onChange={(event) => void updateRowStatus(item, event.target.value as FeedbackStatus)}
                        className={`h-7 cursor-pointer rounded-full border px-2 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${statusClasses[item.status]}`}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} className="bg-background text-foreground">{option.label}</option>
                        ))}
                      </select>
                      {rowSavingId === item.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </div>
                  </td>
                  <td className="px-4 text-[11px] text-muted-foreground"><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {total > PAGE_SIZE && !error && (
        <nav aria-label="Phân trang góp ý" className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="text-[11px] text-muted-foreground">Trang {page} / {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="gap-1"><ChevronLeft className="h-3.5 w-3.5" /> Trước</Button>
            <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="gap-1">Sau <ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </nav>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết góp ý</DialogTitle>
            <DialogDescription>Xem toàn bộ nội dung, ảnh chụp màn hình, trạng thái và ghi chú nội bộ của quản trị viên.</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Đang tải chi tiết...</div>
          ) : detailError && !detail ? (
            <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{detailError}</div>
          ) : detail ? (
            <div className="space-y-4">
              {detailError && <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{detailError}</div>}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${categoryClasses[detail.category]}`}>{CATEGORY_LABELS[detail.category]}</span>
                <span className="text-muted-foreground">{detail.user ? `${detail.user.display_name} · ${detail.user.email}` : "Người dùng đã xoá"}</span>
                <time dateTime={detail.created_at} className="text-muted-foreground">{new Date(detail.created_at).toLocaleString("vi-VN")}</time>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">{detail.content}</div>

              {detail.images.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold">Ảnh chụp màn hình ({detail.images.length})</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {detail.images.map((image, index) => (
                      <a key={`${detail.id}-${index}`} href={image} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-border bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <img src={image} alt={`Ảnh chụp màn hình góp ý ${index + 1}`} className="aspect-video h-full w-full object-cover transition-transform hover:scale-105" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <label className="block space-y-1.5 text-xs font-medium">
                <span>Trạng thái</span>
                <select
                  aria-label="Trạng thái góp ý"
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as FeedbackStatus)}
                  disabled={saving}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label className="block space-y-1.5 text-xs font-medium">
                <span>Ghi chú nội bộ (chỉ quản trị viên)</span>
                <textarea
                  aria-label="Ghi chú nội bộ (chỉ quản trị viên)"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  maxLength={5000}
                  rows={5}
                  disabled={saving}
                  className="flex w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  placeholder="Thêm ghi chú chỉ quản trị viên nhìn thấy..."
                />
                <span className="block text-right text-[10px] font-normal text-muted-foreground">{noteDraft.length}/5000</span>
              </label>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={saving}>Đóng</Button>
                <Button type="button" onClick={() => void saveDetail()} disabled={!dirty || saving}>
                  {saving ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang lưu...</span> : "Lưu"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
