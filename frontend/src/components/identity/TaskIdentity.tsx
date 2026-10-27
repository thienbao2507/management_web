import React from "react"
import { useUsers } from "@/context/UserContext"
import { Avatar, type AvatarProps } from "@/components/ui/Avatar"
import { UserAvatar, userInitials } from "@/components/ui/UserAvatar"
import type { ApiTask } from "@/services/api"

export function useTaskIdentity(task: ApiTask) {
  const { usersById } = useUsers()
  const user = task.assignee_id ? usersById[task.assignee_id] : null
  return { user, name: user?.display_name || (task.assignee_id ? "User unavailable" : task.assignee_name || "Unassigned") }
}
export function TaskAssigneeAvatar({ task, ...props }: { task: ApiTask } & Omit<AvatarProps, "src" | "fallback">) {
  const { user, name } = useTaskIdentity(task)
  return task.assignee_id ? <UserAvatar user={user} title={name} {...props} /> : <Avatar {...props} identityKey={task.id} src={task.assignee_avatar || undefined} fallback={task.assignee_initials || userInitials(task.assignee_name)} alt={name} title={name} />
}
export function TaskAssigneeName({ task }: { task: ApiTask }) { return <>{useTaskIdentity(task).name}</> }
