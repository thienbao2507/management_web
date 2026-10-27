import React, { useRef, useState } from "react"
import { useUsers } from "@/context/UserContext"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { UserAvatar } from "@/components/ui/UserAvatar"

function ProfileForm({ editing }: { editing: boolean }) {
  const { currentUser, saveProfile, openIdentity } = useUsers()
  const [name, setName] = useState(editing ? currentUser?.display_name || "" : "")
  const [email, setEmail] = useState(editing ? currentUser?.email || "" : "")
  const [job, setJob] = useState(editing ? currentUser?.job_title || "" : "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saving = useRef(false)
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault()
    if (saving.current) return
    saving.current = true; setPending(true); setError(null)
    try {
      await saveProfile({ display_name: name.trim(), email: email.trim() || null, job_title: job.trim() || null }, editing ? currentUser?.id : undefined)
      openIdentity(null)
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save profile") }
    finally { saving.current = false; setPending(false) }
  }}>
    {editing && <UserAvatar user={currentUser} size="lg" />}
    {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    <label className="block space-y-1 text-xs">Display name<Input aria-label="Display name" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required disabled={pending} autoFocus /></label>
    <label className="block space-y-1 text-xs">Email (unverified)<Input aria-label="Email (unverified)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} disabled={pending} /></label>
    <label className="block space-y-1 text-xs">Job title<Input aria-label="Job title" value={job} onChange={(event) => setJob(event.target.value)} maxLength={150} disabled={pending} /></label>
    <p className="text-[11px] text-muted-foreground">Profile information is not verified. Choosing a User profile does not sign you in.</p>
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => openIdentity(null)}>Cancel</Button><Button type="submit" disabled={pending || !name.trim()}>{pending ? "Saving..." : editing ? "Save profile" : "Create profile"}</Button></div>
  </form>
}

export function IdentityDialog() {
  const { usersById, currentUser, loading, error, refresh, selectUser, dialogMode, openIdentity } = useUsers()
  return <Dialog open={Boolean(dialogMode)} onOpenChange={(open) => !open && openIdentity(null)}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{dialogMode === "edit" ? "Edit profile" : dialogMode === "create" ? "Create User profile" : "Choose User profile"}</DialogTitle><DialogDescription>Profile selection is a local preference, not authentication or Workspace ownership proof.</DialogDescription></DialogHeader>
      {dialogMode === "select" ? <div className="space-y-3">
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>Refresh identities</Button>
        {loading ? <p role="status" className="text-xs">Loading identities...</p> : error ? <div role="alert" className="space-y-2 text-xs text-red-600 dark:text-red-400"><p>{error}</p><Button variant="outline" onClick={() => void refresh()}>Retry identities</Button></div> : <>
          <div className="space-y-1">
            {Object.values(usersById).filter((user) => user.is_active).map((user) => <button key={user.id} type="button" onClick={() => { selectUser(user.id); openIdentity(null) }} className="flex w-full items-center gap-3 rounded-md border border-border p-2 text-left hover:bg-muted"><UserAvatar user={user} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{user.display_name}</span><span className="block truncate text-[10px] text-muted-foreground">{user.job_title || "User profile"}</span></span>{currentUser?.id === user.id && <span className="text-[10px] text-primary">Selected</span>}</button>)}
          </div>
          {!Object.values(usersById).some((user) => user.is_active) && <p className="text-xs text-muted-foreground">No active User profiles. Create one using your own information.</p>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { selectUser(null); openIdentity(null) }}>Use neutral identity</Button><Button onClick={() => openIdentity("create")}>Create profile</Button>{currentUser && <Button variant="outline" onClick={() => openIdentity("edit")}>Edit profile</Button>}</div>
        </>}
      </div> : dialogMode && <ProfileForm key={`${dialogMode}:${currentUser?.id || "new"}`} editing={dialogMode === "edit"} />}
    </DialogContent>
  </Dialog>
}
