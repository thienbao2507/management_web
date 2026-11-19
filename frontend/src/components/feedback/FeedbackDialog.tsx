import React, { useRef, useState } from "react"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { api, type FeedbackCategory } from "@/services/api"


interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted: () => void
}

const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 900 * 1024
const MAX_IMAGE_DIMENSION = 1920

const selectClassName =
  "flex h-8 w-full rounded-md border border-border bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

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
      reject(new Error("Không thể đọc ảnh đã dán."))
    }
    image.src = objectUrl
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Không thể nén ảnh đã dán."))
      },
      "image/jpeg",
      quality
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Không thể xử lý ảnh đã dán."))
    reader.readAsDataURL(blob)
  })
}

async function compressImage(file: File): Promise<string> {
  const source = await loadImage(file)
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(source.width, source.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Trình duyệt này không hỗ trợ nén ảnh.")
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source, 0, 0, canvas.width, canvas.height)

  let quality = 0.85
  while (quality >= 0.5) {
    const blob = await canvasToJpeg(canvas, quality)
    if (blob.size <= MAX_IMAGE_BYTES) return blobToDataUrl(blob)
    if (quality === 0.5) break
    quality = Math.max(0.5, Number((quality - 0.05).toFixed(2)))
  }

  throw new Error("Ảnh đã dán vẫn lớn hơn 900 KB sau khi nén.")
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  open,
  onOpenChange,
  onSubmitted,
}) => {
  const [category, setCategory] = useState<FeedbackCategory>("feature")
  const [content, setContent] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [processingImages, setProcessingImages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imagesRef = useRef<string[]>([])
  const submitInFlight = useRef(false)
  const imageProcessingInFlight = useRef(false)

  const updateImages = (nextImages: string[]) => {
    imagesRef.current = nextImages
    setImages(nextImages)
  }

  const resetForm = () => {
    setCategory("feature")
    setContent("")
    updateImages([])
    setError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pending) return
    if (!nextOpen) {
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  const handlePaste = async (event: React.ClipboardEvent) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (imageFiles.length === 0) return
    event.preventDefault()

    if (pending) return
    if (imageProcessingInFlight.current) {
      setError("Vui lòng đợi ảnh chụp màn hình hiện tại xử lý xong.")
      return
    }

    const availableSlots = MAX_IMAGES - imagesRef.current.length
    if (availableSlots <= 0) {
      setError("Bạn chỉ có thể đính kèm tối đa 3 ảnh chụp màn hình.")
      return
    }

    const filesToProcess = imageFiles.slice(0, availableSlots)
    let pasteError = imageFiles.length > availableSlots
      ? "Bạn chỉ có thể đính kèm tối đa 3 ảnh chụp màn hình."
      : null

    imageProcessingInFlight.current = true
    setProcessingImages(true)
    setError(null)
    try {
      for (const file of filesToProcess) {
        try {
          const dataUrl = await compressImage(file)
          updateImages([...imagesRef.current, dataUrl])
        } catch (failure) {
          pasteError = failure instanceof Error
            ? failure.message
            : "Không thể xử lý ảnh đã dán."
        }
      }
      setError(pasteError)
    } finally {
      imageProcessingInFlight.current = false
      setProcessingImages(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedContent = content.trim()
    if (!trimmedContent || pending || processingImages || submitInFlight.current) return

    submitInFlight.current = true
    setPending(true)
    setError(null)
    try {
      await api.createFeedback({ category, content: trimmedContent, images })
      resetForm()
      onOpenChange(false)
      onSubmitted()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể gửi góp ý.")
    } finally {
      submitInFlight.current = false
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-xl"
        onPaste={handlePaste}
      >
        <DialogHeader>
          <DialogTitle>Gửi góp ý</DialogTitle>
          <DialogDescription>
            Báo lỗi hoặc đề xuất tính năng. Dán ảnh chụp màn hình bằng Ctrl+V.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <label className="block space-y-1.5 text-xs font-medium">
            <span>Loại</span>
            <select
              aria-label="Loại góp ý"
              value={category}
              onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
              className={selectClassName}
              disabled={pending}
            >
              <option value="feature">Tính năng</option>
              <option value="bug">Lỗi</option>
              <option value="other">Khác</option>
            </select>
          </label>

          <label className="block space-y-1.5 text-xs font-medium">
            <span>Góp ý</span>
            <textarea
              aria-label="Nội dung góp ý"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Cho chúng tôi biết điều gì đã xảy ra hoặc bạn muốn thấy điều gì..."
              maxLength={5000}
              rows={7}
              disabled={pending}
              autoFocus
              className="flex w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="flex justify-between text-[10px] font-normal text-muted-foreground">
              <span>Dán tối đa 3 ảnh chụp màn hình bằng Ctrl+V.</span>
              <span>{content.length}/5000</span>
            </span>
          </label>

          {(images.length > 0 || processingImages) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Ảnh chụp màn hình ({images.length}/{MAX_IMAGES})</span>
                {processingImages && (
                  <span className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Đang nén...
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {images.map((image, index) => (
                  <div key={`${image.slice(-24)}-${index}`} className="relative overflow-hidden rounded-md border border-border bg-muted">
                    <img
                      src={image}
                      alt={`Ảnh chụp màn hình góp ý ${index + 1}`}
                      className="aspect-video h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => updateImages(imagesRef.current.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={pending}
                      aria-label={`Xoá ảnh chụp màn hình ${index + 1}`}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={!content.trim() || pending || processingImages}>
              {pending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang gửi...
                </span>
              ) : "Gửi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
