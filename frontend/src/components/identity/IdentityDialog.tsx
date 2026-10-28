import React, { useEffect, useRef, useState } from "react"
import { useUsers } from "@/context/UserContext"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { UserAvatar } from "@/components/ui/UserAvatar"

export function IdentityDialog() {
  const { currentUser, login, register, verifyEmail, resendVerification, saveProfile, dialogMode, openIdentity } = useUsers()
  const initialToken = new URLSearchParams(window.location.search).get("verify_email_token") || ""
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [job, setJob] = useState("")
  const [token, setToken] = useState(initialToken)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const saving = useRef(false)

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
    if (!dialogMode || saving.current) return
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
      } else if (dialogMode === "register") {
        const result = await register(name.trim(), email, password)
        const delivery = result.email_delivery === "sent" ? "Verification email sent." : result.email_delivery === "not_configured" ? "Email delivery is not configured yet; use Resend after SMTP is configured." : "Email delivery failed; your pending account was kept and can be retried."
        setMessage(`${result.message} ${delivery}`)
        setPassword("")
        openIdentity("verify")
      } else if (dialogMode === "verify") {
        const result = await verifyEmail(token.trim())
        const url = new URL(window.location.href)
        url.searchParams.delete("verify_email_token")
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
        setMessage(result)
        setToken("")
        openIdentity("login")
      } else if (dialogMode === "edit") {
        setMessage(null)
        await saveProfile({ display_name: name.trim(), job_title: job.trim() || null })
        openIdentity(null)
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to complete the request")
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  const title = dialogMode === "register" ? "Create account" : dialogMode === "verify" ? "Verify email" : dialogMode === "edit" ? "Edit profile" : "Sign in"
  const description = dialogMode === "register" ? "Create a verified account for your personal Workspace." : dialogMode === "verify" ? "Use the one-time token from your verification email." : dialogMode === "edit" ? "Update your shared profile identity." : "Sign in to access your Workspace and shared Projects."

  return <Dialog open={Boolean(dialogMode)} onOpenChange={(open) => !open && currentUser && openIdentity(null)}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        {dialogMode === "edit" && <UserAvatar user={currentUser} size="lg" />}
        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {message && <p role="status" className="text-xs text-primary">{message}</p>}
        {(dialogMode === "register" || dialogMode === "edit") && <label className="block space-y-1 text-xs">Display name<Input value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required disabled={pending} autoFocus /></label>}
        {(dialogMode === "login" || dialogMode === "register" || dialogMode === "edit") && <label className="block space-y-1 text-xs">Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required disabled={pending || dialogMode === "edit"} autoFocus={dialogMode === "login"} /></label>}
        {(dialogMode === "login" || dialogMode === "register") && <label className="block space-y-1 text-xs">Password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={dialogMode === "register" ? 15 : 1} maxLength={128} required disabled={pending} autoComplete={dialogMode === "register" ? "new-password" : "current-password"} /></label>}
        {dialogMode === "register" && <p className="text-[11px] text-muted-foreground">Use 15–128 characters. Spaces and Unicode are allowed.</p>}
        {dialogMode === "verify" && <label className="block space-y-1 text-xs">Verification token<Input value={token} onChange={(event) => setToken(event.target.value)} minLength={32} maxLength={256} required disabled={pending} autoFocus /></label>}
        {dialogMode === "edit" && <label className="block space-y-1 text-xs">Job title<Input value={job} onChange={(event) => setJob(event.target.value)} maxLength={150} disabled={pending} /></label>}
        <div className="flex flex-wrap justify-end gap-2">
          {dialogMode === "login" && <Button type="button" variant="outline" onClick={() => openIdentity("register")} disabled={pending}>Register</Button>}
          {dialogMode === "register" && <Button type="button" variant="outline" onClick={() => openIdentity("login")} disabled={pending}>Back to login</Button>}
          {dialogMode === "verify" && <><Button type="button" variant="outline" onClick={() => openIdentity("login")} disabled={pending}>Back to login</Button><Button type="button" variant="outline" disabled={pending || !email.trim()} onClick={async () => { setError(null); try { setMessage(await resendVerification(email)) } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to request another email") } }}>Resend</Button></>}
          {dialogMode === "edit" && <Button type="button" variant="outline" onClick={() => openIdentity(null)} disabled={pending}>Cancel</Button>}
          <Button type="submit" disabled={pending || (dialogMode === "register" && (!name.trim() || password.length < 15)) || (dialogMode === "verify" && token.trim().length < 32)}>{pending ? "Working..." : dialogMode === "register" ? "Register" : dialogMode === "verify" ? "Verify email" : dialogMode === "edit" ? "Save profile" : "Sign in"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
}
