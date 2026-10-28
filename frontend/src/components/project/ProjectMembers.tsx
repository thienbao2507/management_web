import React, { useRef, useState } from "react"
import { api, type ApiMember } from "@/services/api"
import { useUsers } from "@/context/UserContext"
import { UserAvatar } from "@/components/ui/UserAvatar"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/Dialog"

export function ProjectMembers({ projectId, members, loading, error, onRefresh, canManage = false }: { projectId: string; members: ApiMember[]; loading: boolean; error: string | null; onRefresh: () => void; canManage?: boolean }) {
  const { usersById } = useUsers()
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ApiMember | null>(null)
  const busy = useRef(false)

  const act = async (action: () => Promise<unknown>) => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setActionError(null)
    try {
      await action()
      setEmail("")
      setRemoving(null)
      onRefresh()
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "Membership change failed")
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return <div className="flex-1 overflow-y-auto p-4 sm:p-6">
    <h1 className="text-xl font-bold">Team Members</h1>
    <p className="mt-1 text-xs text-muted-foreground">Members are verified accounts with access to this Project.</p>
    {loading ? <p role="status" className="mt-5 text-xs">Loading project members...</p> : error ? <div role="alert" className="mt-5 space-y-2 text-xs text-red-600 dark:text-red-400"><p>{error}</p><Button variant="outline" onClick={onRefresh}>Retry members</Button></div> : <>
      {canManage && <div className="my-5 flex flex-wrap gap-2"><input aria-label="Verified member email" type="email" className="h-8 min-w-64 rounded-md border border-border bg-background px-2 text-xs" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@example.com" disabled={pending} /><Button disabled={!email.trim() || pending} onClick={() => void act(() => api.addMember(projectId, email.trim()))}>{pending ? "Saving..." : "Add member"}</Button></div>}
      {actionError && <p role="alert" className="mb-3 text-xs text-red-600 dark:text-red-400">{actionError}</p>}
      {!members.length && <p className="rounded-lg border border-dashed border-border p-5 text-xs text-muted-foreground">No memberships configured for this project.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{members.map((member) => {
        const user = usersById[member.user_id] || member.user
        return <Card key={member.user_id} className="flex items-center gap-3 p-3"><UserAvatar user={user} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user?.display_name || "User unavailable"}</p><p className="truncate text-[10px] text-muted-foreground">{user?.job_title || "No job title"}{!user?.is_active ? " · inactive" : ""}</p></div>{canManage && <Button variant="ghost" size="sm" onClick={() => { setActionError(null); setRemoving(member) }}>Remove</Button>}</Card>
      })}</div>
    </>}
    <Dialog open={Boolean(removing)} onOpenChange={(open) => !open && !pending && setRemoving(null)}><DialogContent><DialogTitle>Remove {removing ? (usersById[removing.user_id] || removing.user)?.display_name : "member"}?</DialogTitle><DialogDescription>Assigned tasks must be explicitly reassigned first. Removing a membership does not delete the user or silently unassign tasks.</DialogDescription>{actionError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{actionError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setRemoving(null)}>Cancel</Button><Button disabled={pending} variant="destructive" onClick={() => removing && void act(() => api.removeMember(projectId, removing.user_id))}>Remove membership</Button></div></DialogContent></Dialog>
  </div>
}
