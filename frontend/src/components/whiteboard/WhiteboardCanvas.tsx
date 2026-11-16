import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Excalidraw } from "@excalidraw/excalidraw"
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types"
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types"
import "@excalidraw/excalidraw/index.css"
import { Button } from "@/components/ui/Button"
import { useTheme } from "@/context/ThemeContext"
import {
  api,
  ApiError,
  WhiteboardConflictError,
  type ApiWhiteboardDetail,
  type ApiWhiteboardSceneResult,
} from "@/services/api"

const IMAGE_DATA_URL_LIMIT = 2_000_000
const WHITEBOARD_JSON_LIMIT = 4_000_000
const SAVE_DEBOUNCE_MS = 1_500
const SIZE_ERROR_MESSAGE = "Image too large (max ~1.5 MB per image, 4 MB per whiteboard). Remove it to continue saving."
const CONFLICT_MESSAGE = "This whiteboard was changed by someone else. Reload to get the latest version (your unsaved changes will be lost)."

type SaveStatus = "saved" | "dirty" | "saving" | "failed"
type SaveBlockReason = "size" | "error" | "conflict" | null

interface ScenePayload {
  elements: readonly OrderedExcalidrawElement[]
  appState: {
    viewBackgroundColor: string
    gridSize: AppState["gridSize"]
  }
  files: BinaryFiles
}

interface WhiteboardCanvasProps {
  board: ApiWhiteboardDetail
  onSaved: (result: ApiWhiteboardSceneResult) => void
  onReload: () => Promise<void>
}

function sceneFromBoard(board: ApiWhiteboardDetail): ScenePayload {
  const rawElements = board.scene.elements
  const rawAppState = board.scene.appState
  const rawFiles = board.scene.files
  const appState = rawAppState && typeof rawAppState === "object" && !Array.isArray(rawAppState)
    ? rawAppState as Record<string, unknown>
    : {}
  const viewBackgroundColor = typeof appState.viewBackgroundColor === "string"
    ? appState.viewBackgroundColor
    : "#ffffff"
  const gridSize = typeof appState.gridSize === "number"
    ? appState.gridSize as AppState["gridSize"]
    : 20

  return {
    elements: Array.isArray(rawElements)
      ? rawElements as unknown as readonly OrderedExcalidrawElement[]
      : [],
    appState: { viewBackgroundColor, gridSize },
    files: rawFiles && typeof rawFiles === "object" && !Array.isArray(rawFiles)
      ? rawFiles as BinaryFiles
      : {},
  }
}

function contentSignature(
  elements: readonly OrderedExcalidrawElement[],
  files: BinaryFiles
): string {
  const elementSignature = elements
    .map((element) => `${element.id}:${element.version}:${element.isDeleted ? 1 : 0}`)
    .join("|")
  const fileSignature = Object.entries(files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, file]) => `${id}:${file.version || 0}:${file.dataURL.length}`)
    .join("|")
  return `${elements.length}:${elementSignature}:${Object.keys(files).length}:${fileSignature}`
}

function isSceneTooLarge(scene: ScenePayload): boolean {
  const oversizedImage = Object.values(scene.files)
    .some((file) => file.dataURL.length > IMAGE_DATA_URL_LIMIT)
  return oversizedImage || JSON.stringify(scene).length > WHITEBOARD_JSON_LIMIT
}

export default function WhiteboardCanvas({ board, onSaved, onReload }: WhiteboardCanvasProps) {
  const { resolvedTheme } = useTheme()
  const initialScene = useMemo(() => sceneFromBoard(board), [board])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [conflict, setConflict] = useState(false)
  const [sizeError, setSizeError] = useState(false)
  const [reloading, setReloading] = useState(false)

  const mountedRef = useRef(true)
  const unmountingRef = useRef(false)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const blockReasonRef = useRef<SaveBlockReason>(null)
  const baseVersionRef = useRef(board.version)
  const latestSceneRef = useRef<ScenePayload>(initialScene)
  const signatureRef = useRef(contentSignature(initialScene.elements, initialScene.files))
  const debounceTimerRef = useRef<number | null>(null)
  const flushSaveRef = useRef<(options?: { force?: boolean }) => Promise<void>>(async () => {})

  const clearSaveTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  const flushSave = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    clearSaveTimer()
    if (!dirtyRef.current || savingRef.current || blockReasonRef.current === "conflict") return
    if (blockReasonRef.current && !force) return

    const scene = latestSceneRef.current
    if (isSceneTooLarge(scene)) {
      blockReasonRef.current = "size"
      if (mountedRef.current) {
        setSizeError(true)
        setSaveStatus("failed")
      }
      return
    }

    if (blockReasonRef.current === "size") {
      blockReasonRef.current = null
      if (mountedRef.current) setSizeError(false)
    } else if (force && blockReasonRef.current === "error") {
      blockReasonRef.current = null
    }

    dirtyRef.current = false
    savingRef.current = true
    if (mountedRef.current) setSaveStatus("saving")

    try {
      const result = await api.saveWhiteboardScene(
        board.id,
        scene as unknown as Record<string, unknown>,
        baseVersionRef.current
      )
      baseVersionRef.current = result.version
      onSaved(result)
      if (mountedRef.current && !dirtyRef.current) setSaveStatus("saved")
    } catch (requestError) {
      dirtyRef.current = true
      if (requestError instanceof WhiteboardConflictError || (requestError instanceof ApiError && requestError.status === 409)) {
        blockReasonRef.current = "conflict"
        if (mountedRef.current) {
          setConflict(true)
          setSaveStatus("dirty")
        }
      } else if (requestError instanceof ApiError && requestError.status === 413) {
        blockReasonRef.current = "size"
        if (mountedRef.current) {
          setSizeError(true)
          setSaveStatus("failed")
        }
      } else {
        blockReasonRef.current = "error"
        if (mountedRef.current) setSaveStatus("failed")
      }
    } finally {
      savingRef.current = false
      if (dirtyRef.current && blockReasonRef.current === null) {
        if (unmountingRef.current) void flushSaveRef.current({ force: true })
        else void flushSaveRef.current()
      }
    }
  }, [board.id, clearSaveTimer, onSaved])

  useEffect(() => {
    flushSaveRef.current = flushSave
  }, [flushSave])

  const scheduleSave = useCallback(() => {
    clearSaveTimer()
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      void flushSave()
    }, SAVE_DEBOUNCE_MS)
  }, [clearSaveTimer, flushSave])

  useEffect(() => {
    mountedRef.current = true
    unmountingRef.current = false
    return () => {
      mountedRef.current = false
      unmountingRef.current = true
      clearSaveTimer()
      if (dirtyRef.current) void flushSaveRef.current({ force: true })
    }
  }, [clearSaveTimer])

  const handleChange = useCallback((
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) => {
    const nextScene: ScenePayload = {
      elements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
      },
      files,
    }
    latestSceneRef.current = nextScene

    const nextSignature = contentSignature(elements, files)
    if (nextSignature === signatureRef.current) return
    signatureRef.current = nextSignature
    dirtyRef.current = true

    if (isSceneTooLarge(nextScene)) {
      clearSaveTimer()
      blockReasonRef.current = "size"
      setSizeError(true)
      setSaveStatus("failed")
      return
    }

    if (blockReasonRef.current === "size") {
      blockReasonRef.current = null
      setSizeError(false)
    }
    if (savingRef.current) setSaveStatus("saving")
    else if (blockReasonRef.current !== "error") setSaveStatus("dirty")

    if (blockReasonRef.current === null) {
      scheduleSave()
    }
  }, [clearSaveTimer, scheduleSave])

  const retrySave = () => {
    if (blockReasonRef.current === "conflict") return
    blockReasonRef.current = null
    setSizeError(false)
    setSaveStatus("dirty")
    void flushSaveRef.current({ force: true })
  }

  const reloadBoard = async () => {
    if (reloading) return
    setReloading(true)
    try {
      await onReload()
    } finally {
      if (mountedRef.current) setReloading(false)
    }
  }

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden">
      <Excalidraw
        initialData={{
          elements: initialScene.elements,
          appState: initialScene.appState,
          files: initialScene.files,
        }}
        onChange={handleChange}
        theme={resolvedTheme}
      />

      <div className="pointer-events-none absolute right-3 top-3 z-20">
        {saveStatus === "failed" ? (
          <Button className="pointer-events-auto shadow-md" variant="outline" size="sm" onClick={retrySave}>
            Save failed – Retry
          </Button>
        ) : (
          <span className="rounded-md border border-border bg-background/95 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "dirty" ? "Unsaved changes" : "Saved"}
          </span>
        )}
      </div>

      {(conflict || sizeError) && (
        <div className="absolute left-1/2 top-3 z-30 flex w-[min(680px,calc(100%-9rem))] -translate-x-1/2 flex-col gap-2 rounded-md border border-red-500/30 bg-background/95 px-3 py-2 text-xs text-red-600 shadow-lg backdrop-blur dark:text-red-400 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{conflict ? CONFLICT_MESSAGE : SIZE_ERROR_MESSAGE}</span>
          {conflict && (
            <Button variant="outline" size="sm" className="shrink-0 text-foreground" disabled={reloading} onClick={() => void reloadBoard()}>
              {reloading ? "Reloading…" : "Reload"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
