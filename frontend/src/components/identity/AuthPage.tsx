import { useEffect, useState } from "react"
import { Loader2, ShieldCheck, Zap } from "lucide-react"
import { useUsers } from "@/context/UserContext"
import { api, type AuthStatus } from "@/services/api"
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher"
import { Button } from "@/components/ui/Button"
import { IdentityDialog } from "./IdentityDialog"

export function AuthPage() {
  const { dialogMode, openIdentity, error: sessionError, refresh } = useUsers()
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const syncMode = () => {
      const token = new URLSearchParams(window.location.search).get("verify_email_token")
      openIdentity(token || window.location.hash === "#/verify" ? "verify" : window.location.hash === "#/register" ? "register" : "login")
    }
    syncMode()
    window.addEventListener("hashchange", syncMode)
    return () => window.removeEventListener("hashchange", syncMode)
  }, [openIdentity])

  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)
    setCheckError(null)
    api.getAuthStatus(controller.signal).then(setStatus).catch((failure) => {
      if (!controller.signal.aborted) setCheckError(failure instanceof Error ? failure.message : "Không kết nối được dịch vụ đăng nhập.")
    }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [retry])

  const unavailable = status?.ready === false || (dialogMode === "register" && status?.registration_available === false)
  const notice = sessionError || checkError || (unavailable ? status?.message : null)

  return <main className="min-h-screen w-full overflow-y-auto bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
      <a href="#/login" className="flex items-center gap-2.5 text-sm font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Zap className="h-5 w-5" /></span>Project Command Center</a>
      <ThemeSwitcher />
    </header>
    <div className="mx-auto grid min-h-[calc(100vh-92px)] max-w-6xl items-center gap-10 px-5 pb-12 sm:px-8 lg:grid-cols-2 lg:gap-20">
      <section className="hidden space-y-5 lg:block">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Workspace cá nhân của bạn</p>
        <h2 className="max-w-lg text-4xl font-bold leading-tight tracking-tight">Dự án của bạn.<br />Một nơi để tập trung.</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Quản lý dự án, Sprint, công việc và Resources trong một Workspace gắn với tài khoản của bạn.</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Truy cập Workspace của bạn và các dự án được chia sẻ với bạn.</p>
      </section>
      <section aria-label="Truy cập tài khoản" className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        {notice && <div role="alert" className="mb-5 space-y-2 rounded-lg border border-border bg-muted p-3 text-xs"><p>{notice}</p><Button variant="outline" size="sm" onClick={() => { setRetry((value) => value + 1); void refresh() }}>Thử kết nối lại</Button></div>}
        {checking && <p role="status" className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang kết nối dịch vụ đăng nhập...</p>}
        <IdentityDialog inline disabled={checking || Boolean(unavailable)} />
        <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Đã có Workspace từ trước khi có tài khoản? Hãy liên hệ quản trị viên để gắn dữ liệu cũ với tài khoản của bạn.</p>
      </section>
    </div>
  </main>
}
