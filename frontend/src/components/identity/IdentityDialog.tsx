import React, { useEffect, useRef, useState } from "react"
import { useUsers } from "@/context/UserContext"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { api } from "@/services/api"

const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_AVATAR_BYTES = 200 * 1024
const AVATAR_SIZE = 256

function loadAvatarImage(file: File): Promise<HTMLImageElement> {
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

async function prepareAvatarImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Vui lòng chọn một tệp ảnh.")
  if (file.size > MAX_AVATAR_SOURCE_BYTES) throw new Error("Ảnh gốc không được lớn hơn 15 MB.")

  const source = await loadAvatarImage(file)
  const sourceSize = Math.min(source.naturalWidth, source.naturalHeight)
  const sourceX = (source.naturalWidth - sourceSize) / 2
  const sourceY = (source.naturalHeight - sourceSize) / 2
  const canvas = document.createElement("canvas")
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.")

  const drawImage = (fillWhite: boolean) => {
    context.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    if (fillWhite) {
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    }
    context.drawImage(
      source,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
  }

  drawImage(false)
  let mimeType = "image/webp"
  let blob = await canvasToBlob(canvas, mimeType, 0.85)
  if (!blob || blob.type !== mimeType) {
    mimeType = "image/jpeg"
    drawImage(true)
    blob = await canvasToBlob(canvas, mimeType, 0.85)
  }
  if (!blob) throw new Error("Không thể nén ảnh này.")

  for (const quality of [0.75, 0.65, 0.55]) {
    if (blob.size <= MAX_AVATAR_BYTES) break
    blob = await canvasToBlob(canvas, mimeType, quality)
    if (!blob) throw new Error("Không thể nén ảnh này.")
  }
  if (blob.size > MAX_AVATAR_BYTES) throw new Error("Ảnh vẫn lớn hơn 200 KB sau khi nén.")
  return blobToDataUrl(blob)
}

export function IdentityDialog({ inline = false, disabled = false }: { inline?: boolean; disabled?: boolean }) {
  const { currentUser, login, register, verifyEmail, resendVerification, saveProfile, updateCurrentAvatar, dialogMode: selectedMode, openIdentity } = useUsers()
  const dialogMode = selectedMode || "login"
  const initialToken = new URLSearchParams(window.location.search).get("verify_email_token") || ""
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [job, setJob] = useState("")
  const [token, setToken] = useState(initialToken)
  const [pending, setPending] = useState(false)
  const [avatarPending, setAvatarPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const saving = useRef(false)
  const avatarInput = useRef<HTMLInputElement>(null)

  const changeMode = (mode: "login" | "register" | "verify") => {
    setError(null)
    setMessage(null)
    setPassword("")
    setConfirmPassword("")
    openIdentity(mode)
    if (inline) window.location.hash = `/${mode}`
  }

  useEffect(() => {
    if (initialToken && !currentUser) openIdentity("verify")
  }, [currentUser, initialToken, openIdentity])

  useEffect(() => {
    setError(null)
    if (dialogMode === "edit" && currentUser) {
      setName(currentUser.display_name)
      setEmail(currentUser.email || "")
      setJob(currentUser.job_title || "")
    }
  }, [currentUser, dialogMode])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (disabled || saving.current || avatarPending) return
    saving.current = true
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      if (dialogMode === "login") {
        setMessage(null)
        await login(email, password)
        setPassword("")
        openIdentity(null)
        if (["#/login", "#/register", "#/verify"].includes(window.location.hash)) window.location.hash = "/active-sprint"
      } else if (dialogMode === "register") {
        if (password !== confirmPassword) throw new Error("Mật khẩu không khớp.")
        const result = await register(name.trim(), email, password)
        if (result.status === "completed") {
          setMessage(result.message || "Tạo tài khoản thành công. Bạn có thể đăng nhập ngay.")
          setPassword("")
          setConfirmPassword("")
          openIdentity("login")
          if (inline) window.location.hash = "/login"
        } else {
          const delivery = result.email_delivery === "sent" ? "Hãy kiểm tra hộp thư để lấy liên kết xác minh." : "Không gửi được email xác minh. Hãy thử lại bằng nút Gửi lại hoặc liên hệ quản trị viên."
          setMessage(`${result.message} ${delivery}`)
          setPassword("")
          setConfirmPassword("")
          openIdentity("verify")
          if (inline) window.location.hash = "/verify"
        }
      } else if (dialogMode === "verify") {
        const result = await verifyEmail(token.trim())
        const url = new URL(window.location.href)
        url.searchParams.delete("verify_email_token")
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
        setMessage(result)
        setToken("")
        openIdentity("login")
        if (inline) window.location.hash = "/login"
      } else if (dialogMode === "edit") {
        setMessage(null)
        await saveProfile({ display_name: name.trim(), job_title: job.trim() || null })
        openIdentity(null)
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thực hiện được yêu cầu")
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file || avatarPending) return

    setAvatarPending(true)
    setError(null)
    setMessage(null)
    try {
      const image = await prepareAvatarImage(file)
      const result = await api.uploadMyAvatar(image)
      updateCurrentAvatar(result.custom_avatar_url)
      setMessage("Ảnh đại diện đã được cập nhật.")
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể cập nhật ảnh đại diện.")
    } finally {
      setAvatarPending(false)
    }
  }

  const deleteAvatar = async () => {
    if (!currentUser?.custom_avatar_url || avatarPending) return
    setAvatarPending(true)
    setError(null)
    setMessage(null)
    try {
      await api.deleteMyAvatar()
      updateCurrentAvatar(null)
      setMessage("Ảnh đại diện tuỳ chỉnh đã được xoá.")
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể xoá ảnh đại diện.")
    } finally {
      setAvatarPending(false)
    }
  }

  const title = dialogMode === "register" ? "Tạo tài khoản" : dialogMode === "verify" ? "Xác minh email" : dialogMode === "edit" ? "Sửa hồ sơ" : "Đăng nhập"
  const description = dialogMode === "register" ? "Tạo tài khoản đã xác minh cho Workspace cá nhân của bạn." : dialogMode === "verify" ? "Dùng mã dùng một lần trong email xác minh." : dialogMode === "edit" ? "Cập nhật thông tin hồ sơ của bạn." : "Đăng nhập để truy cập Workspace và các dự án được chia sẻ."

  const form = <form className="space-y-4" onSubmit={submit}>
      <fieldset className="min-w-0 space-y-4" disabled={pending || avatarPending}>
        {dialogMode === "edit" && <div className="flex items-center gap-3">
          <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => avatarInput.current?.click()} aria-label="Đổi ảnh đại diện">
            <UserAvatar user={currentUser} size="lg" className="h-16 w-16 text-xl" />
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => avatarInput.current?.click()}>Đổi ảnh</Button>
            {currentUser?.custom_avatar_url && <Button type="button" variant="destructive" onClick={() => void deleteAvatar()}>Xoá ảnh</Button>}
            {avatarPending && <span role="status" className="text-xs text-muted-foreground">Đang tải ảnh...</span>}
          </div>
        </div>}
        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {message && <p role="status" className="text-xs text-primary">{message}</p>}
        {(dialogMode === "register" || dialogMode === "edit") && <label className="block space-y-1 text-xs">Tên hiển thị<Input value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required disabled={pending} autoFocus /></label>}
        {(dialogMode === "login" || dialogMode === "register" || dialogMode === "verify" || dialogMode === "edit") && <label className="block space-y-1 text-xs">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required={dialogMode !== "verify"} disabled={pending || dialogMode === "edit"} autoComplete="email" autoFocus={dialogMode === "login"} /></label>}
        {(dialogMode === "login" || dialogMode === "register") && <label className="block space-y-1 text-xs">Mật khẩu<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={dialogMode === "register" ? 8 : 1} maxLength={128} required disabled={pending} autoComplete={dialogMode === "register" ? "new-password" : "current-password"} /></label>}
        {dialogMode === "register" && <label className="block space-y-1 text-xs">Xác nhận mật khẩu<Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} maxLength={128} required disabled={pending} autoComplete="new-password" aria-invalid={confirmPassword.length > 0 && confirmPassword !== password} /></label>}
        {dialogMode === "register" && (confirmPassword.length > 0 && confirmPassword !== password
          ? <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">Mật khẩu không khớp.</p>
          : <p className="text-[11px] text-muted-foreground">Dùng 8–128 ký tự. Cho phép khoảng trắng và Unicode.</p>)}
        {dialogMode === "verify" && <label className="block space-y-1 text-xs">Mã xác minh<Input value={token} onChange={(event) => setToken(event.target.value)} minLength={32} maxLength={256} required disabled={pending} autoFocus /></label>}
        {dialogMode === "edit" && <label className="block space-y-1 text-xs">Chức danh<Input value={job} onChange={(event) => setJob(event.target.value)} maxLength={150} disabled={pending} /></label>}
        <div className="flex flex-wrap justify-end gap-2">
          {dialogMode === "login" && <><Button type="button" variant="outline" onClick={() => changeMode("register")} disabled={pending}>Đăng ký</Button><Button type="button" variant="ghost" onClick={() => changeMode("verify")} disabled={pending}>Xác minh email</Button></>}
          {dialogMode === "register" && <Button type="button" variant="outline" onClick={() => changeMode("login")} disabled={pending}>Quay lại đăng nhập</Button>}
          {dialogMode === "verify" && <><Button type="button" variant="outline" onClick={() => changeMode("login")} disabled={pending}>Quay lại đăng nhập</Button><Button type="button" variant="outline" disabled={disabled || pending || !email.trim()} onClick={async () => { if (saving.current) return; saving.current = true; setPending(true); setError(null); try { setMessage(await resendVerification(email)) } catch (failure) { setError(failure instanceof Error ? failure.message : "Không yêu cầu được email mới") } finally { saving.current = false; setPending(false) } }}>Gửi lại</Button></>}
          {dialogMode === "edit" && <Button type="button" variant="outline" onClick={() => openIdentity(null)} disabled={pending || avatarPending}>Huỷ</Button>}
          <Button type="submit" disabled={disabled || pending || (dialogMode === "register" && (!name.trim() || password.length < 8 || password !== confirmPassword)) || (dialogMode === "verify" && token.trim().length < 32)}>{pending ? "Đang xử lý..." : dialogMode === "register" ? "Đăng ký" : dialogMode === "verify" ? "Xác minh email" : dialogMode === "edit" ? "Lưu hồ sơ" : "Đăng nhập"}</Button>
        </div>
      </fieldset>
    </form>

  if (inline) return <><div className="mb-6 space-y-2"><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></div>{form}</>

  return <Dialog open={Boolean(selectedMode) && Boolean(currentUser)} onOpenChange={(open) => !open && openIdentity(null)}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {form}
    </DialogContent>
  </Dialog>
}
