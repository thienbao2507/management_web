import React, { useRef, useState } from "react"
import { Clipboard, ImagePlus, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { useBackground } from "@/context/BackgroundContext"

const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_BACKGROUND_BYTES = 1536 * 1024
const MAX_BACKGROUND_DIMENSION = 1920
const DEFAULT_DIM = 40

function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Không thể đọc ảnh này."))
    }
    image.src = objectUrl
  })
}

function drawImage(
  canvas: HTMLCanvasElement,
  source: HTMLImageElement,
  width: number,
  height: number,
  fillWhite: boolean,
) {
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Image compression is unavailable in this browser.")
  context.clearRect(0, 0, width, height)
  if (fillWhite) {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(source, 0, 0, width, height)
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Không thể xử lý ảnh này."))
    reader.readAsDataURL(blob)
  })
}

async function compressBackgroundImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.")
  if (file.size > MAX_SOURCE_BYTES) throw new Error("The original image must be 15 MB or smaller.")

  const source = await loadImage(file)
  const initialScale = Math.min(1, MAX_BACKGROUND_DIMENSION / Math.max(source.width, source.height))
  const initialWidth = Math.max(1, Math.round(source.width * initialScale))
  const initialHeight = Math.max(1, Math.round(source.height * initialScale))
  const canvas = document.createElement("canvas")

  drawImage(canvas, source, initialWidth, initialHeight, false)
  const webpProbe = await canvasToBlob(canvas, "image/webp", 0.8)
  const useWebp = webpProbe?.type === "image/webp"
  if (useWebp && webpProbe.size <= MAX_BACKGROUND_BYTES) return blobToDataUrl(webpProbe)

  const mimeType = useWebp ? "image/webp" : "image/jpeg"
  const qualityLevels = useWebp ? [0.8, 0.7, 0.6, 0.5, 0.4] : [0.82, 0.72, 0.62, 0.52, 0.45]
  const dimensionScales = [1, 0.85, 0.7, 0.55]

  for (const dimensionScale of dimensionScales) {
    const width = Math.max(1, Math.round(initialWidth * dimensionScale))
    const height = Math.max(1, Math.round(initialHeight * dimensionScale))
    drawImage(canvas, source, width, height, !useWebp)

    for (const quality of qualityLevels) {
      const blob = await canvasToBlob(canvas, mimeType, quality)
      if (!blob) throw new Error("Không thể nén ảnh này.")
      if (blob.size <= MAX_BACKGROUND_BYTES) return blobToDataUrl(blob)
    }
  }

  throw new Error("Ảnh vẫn lớn hơn 1,5 MB sau khi nén.")
}

type PendingAction = "save" | "remove" | null

function BackgroundDialogContent({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const { background, save, setDim, remove, setDialogOpen } = useBackground()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [dim, setDimValue] = useState(background?.dim ?? DEFAULT_DIM)
  const [processingImage, setProcessingImage] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const busy = processingImage || pendingAction !== null
  const previewImage = selectedImage || background?.image || null
  const hasChanges = selectedImage !== null || Boolean(background && dim !== background.dim)

  const processFile = async (file: File) => {
    if (busy) return
    setProcessingImage(true)
    onBusyChange(true)
    setError(null)
    try {
      setSelectedImage(await compressBackgroundImage(file))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể xử lý ảnh này.")
    } finally {
      setProcessingImage(false)
      onBusyChange(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (file) void processFile(file)
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.kind === "file")
      ?.getAsFile()
    if (!file) return
    event.preventDefault()
    void processFile(file)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || !hasChanges) return

    setPendingAction("save")
    onBusyChange(true)
    setError(null)
    try {
      if (selectedImage) await save(selectedImage, dim)
      else await setDim(dim)
      setDialogOpen(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể lưu hình nền.")
    } finally {
      setPendingAction(null)
      onBusyChange(false)
    }
  }

  const handleRemove = async () => {
    if (busy || !background) return

    setPendingAction("remove")
    onBusyChange(true)
    setError(null)
    try {
      await remove()
      setDialogOpen(false)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể xoá hình nền.")
    } finally {
      setPendingAction(null)
      onBusyChange(false)
    }
  }

  return (
    <DialogContent
      className="max-h-[92vh] overflow-y-auto sm:max-w-xl"
      onPaste={handlePaste}
      onEscapeKeyDown={(event) => busy && event.preventDefault()}
      onPointerDownOutside={(event) => busy && event.preventDefault()}
    >
        <DialogHeader>
          <DialogTitle>Hình nền tuỳ chỉnh</DialogTitle>
          <DialogDescription>
            Chọn hoặc dán một ảnh, sau đó chỉnh lớp phủ để giao diện vẫn dễ đọc.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
            {previewImage ? (
              <>
                <img src={previewImage} alt="Xem trước hình nền" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-background" style={{ opacity: dim / 100 }} />
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <ImagePlus className="h-8 w-8" />
                <span>Chưa có hình nền tuỳ chỉnh</span>
              </div>
            )}
            {processingImage && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-xs font-medium">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang nén ảnh…
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
              disabled={busy}
              aria-label="Chọn ảnh hình nền"
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> Chọn ảnh
            </Button>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clipboard className="h-3.5 w-3.5" /> Hoặc dán bằng Ctrl+V
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Ảnh tối đa 15 MB sẽ được thu nhỏ về 1920px và nén trước khi tải lên.
          </p>

          <label className="block space-y-2 text-xs font-medium">
            <span className="flex items-center justify-between">
              <span>Lớp phủ</span>
              <span className="tabular-nums text-muted-foreground">{dim}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="80"
              value={dim}
              onChange={(event) => setDimValue(Number(event.currentTarget.value))}
              disabled={busy}
              className="w-full accent-primary"
              aria-label="Lớp phủ hình nền"
            />
          </label>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="destructive" onClick={() => void handleRemove()} disabled={busy || !background} className="sm:mr-auto">
              {pendingAction === "remove" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              {pendingAction === "remove" ? "Đang xoá…" : "Xoá"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Huỷ
            </Button>
            <Button type="submit" disabled={busy || !hasChanges}>
              {pendingAction === "save" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {pendingAction === "save" ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  )
}

export function BackgroundDialog() {
  const { background, dialogOpen, setDialogOpen } = useBackground()
  const busyRef = useRef(false)

  const handleOpenChange = (open: boolean) => {
    if (!open && busyRef.current) return
    setDialogOpen(open)
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {dialogOpen && (
        <BackgroundDialogContent
          key={`${background?.updated_at || "none"}:${background?.dim ?? DEFAULT_DIM}`}
          onBusyChange={(busy) => { busyRef.current = busy }}
        />
      )}
    </Dialog>
  )
}
