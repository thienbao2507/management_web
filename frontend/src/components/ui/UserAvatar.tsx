import React from "react"
import { Avatar, type AvatarProps } from "./Avatar"
import type { ApiUser, AvatarKey } from "@/services/api"

// Intentionally empty: the six approved images have not been supplied.
// Register only real, approved bundled assets here; never invent asset paths.
export const approvedAvatarAssets: Partial<Record<AvatarKey, string>> = {}
export function userInitials(name?: string | null) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean)
  return words.length ? [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])].map((word) => Array.from(word)[0]).join("").toLocaleUpperCase() : "?"
}
export function resolveUserAvatar(user?: ApiUser | null) {
  return { src: user?.custom_avatar_url || undefined, fallbackSrc: user ? approvedAvatarAssets[user.default_avatar_key] : undefined, fallback: userInitials(user?.display_name) }
}
export function UserAvatar({ user, ...props }: Omit<AvatarProps, "fallback" | "src" | "fallbackSrc"> & { user?: ApiUser | null }) {
  return <Avatar {...props} {...resolveUserAvatar(user)} identityKey={user?.id || "neutral"} alt={user?.display_name || "No identity selected"} />
}
