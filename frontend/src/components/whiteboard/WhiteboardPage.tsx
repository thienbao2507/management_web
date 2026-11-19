import React, { lazy, Suspense, useCallback, useEffect, useState } from "react"
import { Loader2, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"
import {
  api,
  type ApiProject,
  type ApiWhiteboardDetail,
  type ApiWhiteboardSceneResult,
  type ApiWhiteboardSummary,
} from "@/services/api"
import { cn } from "@/lib/utils"

const WhiteboardCanvas = lazy(() => import("./WhiteboardCanvas"))
const LIST_COLLAPSED_KEY = "whiteboard:list-collapsed"

interface WhiteboardPageProps {
  project: ApiProject | null
}

function selectionStorageKey(projectId: string): string {
  return `management_web_whiteboard_id:${projectId}`
}

function readStoredSelection(projectId: string): string | null {
  try {
    return localStorage.getItem(selectionStorageKey(projectId))
  } catch {
    return null
  }
}

function writeStoredSelection(projectId: string, boardId: string | null): void {
  try {
    if (boardId) localStorage.setItem(selectionStorageKey(projectId), boardId)
    else localStorage.removeItem(selectionStorageKey(projectId))
  } catch {
    // Keep the in-memory selection when storage is unavailable.
  }
}

function formatUpdatedAt(value: string): string {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return value
  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" })
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second")
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return formatter.format(days, "day")
  return new Date(value).toLocaleDateString("vi-VN")
}

function sortBoards(items: ApiWhiteboardSummary[]): ApiWhiteboardSummary[] {
  return [...items].sort((left, right) => {
    const updatedDifference = new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    return updatedDifference || right.id.localeCompare(left.id)
  })
}

export const WhiteboardPage: React.FC<WhiteboardPageProps> = ({ project }) => {
  const [boards, setBoards] = useState<ApiWhiteboardSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedBoard, setSelectedBoard] = useState<ApiWhiteboardDetail | null>(null)
  const [loadingList, setLoadingList] = useState(Boolean(project))
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [creating, setCreating] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renameBoard, setRenameBoard] = useState<ApiWhiteboardSummary | null>(null)
  const [renameTitle, setRenameTitle] = useState("")
  const [deleteBoard, setDeleteBoard] = useState<ApiWhiteboardSummary | null>(null)
  const [canvasRevision, setCanvasRevision] = useState(0)
  const [listCollapsed, setListCollapsed] = useState(() => {
    try { return localStorage.getItem(LIST_COLLAPSED_KEY) === "1" } catch { return false }
  })
  const toggleListCollapsed = () => {
    setListCollapsed((value) => {
      const next = !value
      try { localStorage.setItem(LIST_COLLAPSED_KEY, next ? "1" : "0") } catch { /* storage unavailable */ }
      return next
    })
  }

  const chooseBoard = useCallback((boardId: string | null) => {
    if (boardId !== selectedId) {
      setLoadingBoard(Boolean(boardId))
      setError(null)
    }
    setSelectedId(boardId)
    setSelectedBoard((current) => current?.id === boardId ? current : null)
    if (project) writeStoredSelection(project.id, boardId)
  }, [project, selectedId])

  useEffect(() => {
    if (!project) return

    const controller = new AbortController()
    void api.listWhiteboards(project.id, controller.signal)
      .then(({ items }) => {
        const sortedItems = sortBoards(items)
        setBoards(sortedItems)
        const storedId = readStoredSelection(project.id)
        const nextId = sortedItems.some((board) => board.id === storedId)
          ? storedId
          : sortedItems[0]?.id || null
        setLoadingBoard(Boolean(nextId))
        setSelectedId(nextId)
        writeStoredSelection(project.id, nextId)
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
        setError(requestError instanceof Error ? requestError.message : "Không thể tải danh sách whiteboard")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingList(false)
      })
    return () => controller.abort()
  }, [project])

  useEffect(() => {
    if (!project || !selectedId) return
    const controller = new AbortController()
    void api.getWhiteboard(selectedId, controller.signal)
      .then((board) => {
        if (board.project_id === project.id) setSelectedBoard(board)
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
        setError(requestError instanceof Error ? requestError.message : "Không thể tải whiteboard này")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBoard(false)
      })
    return () => controller.abort()
  }, [project, selectedId])

  const createBoard = async () => {
    if (!project || creating) return
    setCreating(true)
    setError(null)
    try {
      const created = await api.createWhiteboard(project.id, "Whiteboard chưa đặt tên")
      setBoards((current) => sortBoards([created, ...current.filter((board) => board.id !== created.id)]))
      setSelectedBoard(created)
      chooseBoard(created.id)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tạo whiteboard")
    } finally {
      setCreating(false)
    }
  }

  const submitRename = async () => {
    const title = renameTitle.trim()
    if (!renameBoard || !title || actionPending) return
    setActionPending(true)
    setError(null)
    try {
      const updated = await api.renameWhiteboard(renameBoard.id, title)
      setBoards((current) => current.map((board) => board.id === updated.id ? updated : board))
      setSelectedBoard((current) => current?.id === updated.id ? { ...current, ...updated } : current)
      setRenameBoard(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể đổi tên whiteboard")
    } finally {
      setActionPending(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteBoard || actionPending) return
    const boardId = deleteBoard.id
    setActionPending(true)
    setError(null)
    try {
      await api.deleteWhiteboard(boardId)
      const remaining = boards.filter((board) => board.id !== boardId)
      setBoards(remaining)
      if (selectedId === boardId) {
        setSelectedBoard(null)
        chooseBoard(remaining[0]?.id || null)
      }
      setDeleteBoard(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xoá whiteboard")
    } finally {
      setActionPending(false)
    }
  }

  const handleSaved = useCallback((result: ApiWhiteboardSceneResult) => {
    setBoards((current) => sortBoards(current.map((board) => board.id === result.id
      ? { ...board, version: result.version, updated_at: result.updated_at }
      : board)))
    setSelectedBoard((current) => current?.id === result.id
      ? { ...current, version: result.version, updated_at: result.updated_at }
      : current)
  }, [])

  const reloadSelectedBoard = useCallback(async () => {
    if (!selectedId) return
    const latest = await api.getWhiteboard(selectedId)
    setSelectedBoard(latest)
    setBoards((current) => sortBoards(current.map((board) => board.id === latest.id ? latest : board)))
    setCanvasRevision((value) => value + 1)
  }, [selectedId])

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Chọn một dự án để dùng whiteboard
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 bg-background">
      {listCollapsed ? (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-2 border-r border-border bg-card/40 py-3">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={toggleListCollapsed}
          aria-label="Hiện danh sách whiteboard"
          title="Hiện danh sách whiteboard"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <Button
          size="iconSm"
          onClick={() => void createBoard()}
          disabled={creating}
          aria-label="Whiteboard mới"
          title="Whiteboard mới"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </aside>
      ) : (
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Whiteboards</h2>
            <p className="truncate text-[10px] text-muted-foreground">{project.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="iconSm"
              onClick={() => void createBoard()}
              disabled={creating}
              aria-label="Whiteboard mới"
              title="Whiteboard mới"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={toggleListCollapsed}
              aria-label="Ẩn danh sách whiteboard"
              title="Ẩn danh sách whiteboard"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error &&<p role="alert" className="border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loadingList ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải whiteboard…
            </div>
          ) : boards.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
              <p className="text-xs font-medium">Chưa có whiteboard nào</p>
              <p className="text-[11px] text-muted-foreground">Tạo một bảng để phác thảo ý tưởng cùng nhóm dự án.</p>
              <Button size="sm" onClick={() => void createBoard()} disabled={creating}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Tạo whiteboard
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className={cn(
                    "group flex items-start rounded-md border border-transparent transition-colors",
                    selectedId === board.id ? "border-primary/20 bg-primary/10" : "hover:bg-muted/70"
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-2.5 py-2 text-left"
                    onClick={() => chooseBoard(board.id)}
                  >
                    <span className="block truncate text-xs font-medium">{board.title}</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                      Cập nhật {formatUpdatedAt(board.updated_at)} bởi {board.updated_by_name || "Không rõ"}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        className="mt-1 mr-1 shrink-0"
                        aria-label={`Thêm thao tác cho ${board.title}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => {
                        setRenameBoard(board)
                        setRenameTitle(board.title)
                      }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Đổi tên
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => setDeleteBoard(board)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Xoá
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
      )}

      <section className="relative flex min-h-[480px] min-w-0 flex-1 overflow-hidden">
        {loadingBoard || (selectedId && selectedBoard?.id !== selectedId) ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Đang tải bảng vẽ…
          </div>
        ) : selectedBoard ? (
          <Suspense fallback={
            <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Đang tải Excalidraw…
            </div>
          }>
            <WhiteboardCanvas
              key={`${selectedBoard.id}:${canvasRevision}`}
              board={selectedBoard}
              onSaved={handleSaved}
              onReload={reloadSelectedBoard}
            />
          </Suspense>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Tạo hoặc chọn một whiteboard để bắt đầu vẽ
          </div>
        )}
      </section>

      <Dialog open={Boolean(renameBoard)} onOpenChange={(open) => !open && !actionPending && setRenameBoard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên whiteboard</DialogTitle>
            <DialogDescription>Chọn một tên rõ ràng cho whiteboard của dự án.</DialogDescription>
          </DialogHeader>
          <label className="space-y-1.5 text-xs font-medium">
            <span>Tên whiteboard</span>
            <input
              autoFocus
              value={renameTitle}
              maxLength={255}
              onChange={(event) => setRenameTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitRename()
              }}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameBoard(null)} disabled={actionPending}>Huỷ</Button>
            <Button onClick={() => void submitRename()} disabled={actionPending || !renameTitle.trim()}>
              {actionPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Đổi tên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteBoard)} onOpenChange={(open) => !open && !actionPending && setDeleteBoard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá “{deleteBoard?.title}”?</DialogTitle>
            <DialogDescription>Thao tác này xoá vĩnh viễn whiteboard và các nét vẽ trong đó.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBoard(null)} disabled={actionPending}>Huỷ</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={actionPending}>
              {actionPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Xoá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
