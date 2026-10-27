import {
  FileSpreadsheet,
  FileText,
  Files,
  GitBranch,
  Globe2,
  Link2,
  Palette,
} from "lucide-react"
import type { ResourceType } from "@/services/api"


export const RESOURCE_TYPE_STYLES: Record<
  ResourceType,
  { icon: typeof Link2; className: string }
> = {
  Website: {
    icon: Globe2,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  "Google Docs": {
    icon: FileText,
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  "Google Sheets": {
    icon: FileSpreadsheet,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  "Google Drive": {
    icon: Files,
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  Canva: {
    icon: Palette,
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  Word: {
    icon: FileText,
    className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  GitHub: {
    icon: GitBranch,
    className: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  Other: {
    icon: Link2,
    className: "bg-muted text-muted-foreground",
  },
}

export function formatResourceDate(value: string, includeTime = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
    ...(includeTime ? { timeStyle: "medium" as const } : {}),
  }).format(date)
}

export function validateResourceUrl(value: string): string | null {
  const candidate = value.trim()
  if (!candidate) return "Resource URL is required."
  if (candidate.length > 2048) return "Resource URL cannot exceed 2048 characters."
  if (/\s/.test(candidate)) return "Resource URL cannot contain spaces."
  if (!/^https?:\/\//i.test(candidate) || candidate.includes("\\") || Array.from(candidate).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    return "Enter a complete HTTP or HTTPS URL with a valid hostname."
  }

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Only HTTP and HTTPS links are allowed."
    }
    if (!parsed.hostname) return "Resource URL must include a valid hostname."
    if (parsed.hostname.startsWith(".") || parsed.hostname.endsWith(".") || parsed.hostname.includes("..")) {
      return "Resource URL must include a valid hostname."
    }
    if (!parsed.hostname.startsWith("[") && (parsed.hostname.length > 253 || parsed.hostname.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))) {
      return "Resource URL must include a valid hostname."
    }
    if (parsed.username || parsed.password) {
      return "Do not include credentials in a resource URL."
    }
    const sensitiveParameters = new Set(["access_token", "refresh_token", "id_token", "token", "api_key", "apikey", "password", "passwd", "client_secret", "authorization"])
    const parameterNames = [...parsed.searchParams.keys(), ...new URLSearchParams(parsed.hash.slice(1)).keys()]
    if (parameterNames.some((name) => sensitiveParameters.has(name.toLowerCase()))) {
      return "Do not save passwords or access tokens in resource URLs."
    }
  } catch {
    return "Enter a complete HTTP or HTTPS URL with a valid hostname."
  }

  return null
}
