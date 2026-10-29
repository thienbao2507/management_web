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
      if (!controller.signal.aborted) setCheckError(failure instanceof Error ? failure.message : "Could not connect to the sign-in service.")
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
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your personal workspace</p>
        <h2 className="max-w-lg text-4xl font-bold leading-tight tracking-tight">Your projects.<br />One place to focus.</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Manage Projects, Sprints, Tasks and Resources from a Workspace connected to your account.</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Access your Workspace and Projects shared with you.</p>
      </section>
      <section aria-label="Account access" className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        {notice && <div role="alert" className="mb-5 space-y-2 rounded-lg border border-border bg-muted p-3 text-xs"><p>{notice}</p><Button variant="outline" size="sm" onClick={() => { setRetry((value) => value + 1); void refresh() }}>Retry connection</Button></div>}
        {checking && <p role="status" className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting to sign-in service...</p>}
        <IdentityDialog inline disabled={checking || Boolean(unavailable)} />
        <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Already had a Workspace before accounts were introduced? Contact the administrator to connect your existing data to your account.</p>
      </section>
    </div>
  </main>
}
