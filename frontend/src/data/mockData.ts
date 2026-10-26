export type Priority = "low" | "medium" | "high" | "urgent"
export type TaskStatus = "backlog" | "todo" | "in_progress" | "done"

export interface User {
  id: string
  name: string
  role: string
  avatar: string
  email: string
  initials: string
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Task {
  id: string
  key: string
  title: string
  description: string
  category: string
  priority: Priority
  status: TaskStatus
  assignee: User
  dueDate: string
  startDate?: string
  subtasks: Subtask[]
  commentsCount: number
  attachmentsCount?: number
  thumbnail?: string
  isBlocked?: boolean
  blockerReason?: string
  weight?: number
}

export interface Project {
  id: string
  key: string
  name: string
  description: string
  plannedProgress: number
  actualProgress: number
  health: "on_track" | "at_risk" | "delayed"
  startDate: string
  dueDate: string
  lead: User
}

export interface Sprint {
  id: string
  name: string
  goal: string
  startDate: string
  endDate: string
  totalPoints: number
  completedPoints: number
}

export const USERS: Record<string, User> = {
  alex: {
    id: "u-1",
    name: "Alex Morgan",
    role: "Lead Product Designer",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop&crop=faces",
    email: "alex.m@command.io",
    initials: "AM"
  },
  sarah: {
    id: "u-2",
    name: "Sarah Chen",
    role: "Senior Frontend Engineer",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=128&h=128&fit=crop&crop=faces",
    email: "sarah.c@command.io",
    initials: "SC"
  },
  david: {
    id: "u-3",
    name: "David Miller",
    role: "Fullstack Engineer",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop&crop=faces",
    email: "david.m@command.io",
    initials: "DM"
  },
  emily: {
    id: "u-4",
    name: "Emily Nguyen",
    role: "DevOps & QA Specialist",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&crop=faces",
    email: "emily.n@command.io",
    initials: "EN"
  },
  michael: {
    id: "u-5",
    name: "Michael Scott",
    role: "Engineering Manager",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop&crop=faces",
    email: "michael.s@command.io",
    initials: "MS"
  }
}

export const CURRENT_WORKSPACE = {
  id: "ws-1",
  name: "Apex Command Center",
  slug: "apex-corp",
  icon: "Zap",
  plan: "Enterprise Scale"
}

export const CURRENT_SPRINT: Sprint = {
  id: "sp-24",
  name: "Sprint 24 — Q4 Performance & Polish",
  goal: "Optimize core command views, reduce response latencies and finalize Dark Theme token system.",
  startDate: "2026-10-15",
  endDate: "2026-11-05",
  totalPoints: 64,
  completedPoints: 42
}

export const INITIAL_TASKS: Task[] = [
  {
    id: "task-1",
    key: "CMD-101",
    title: "Benchmark cold-load performance on simulated 3G networks",
    description: "Run Lighthouse and WebPageTest audits across major screen viewports to ensure FID < 100ms and LCP < 1.8s.",
    category: "Performance",
    priority: "low",
    status: "backlog",
    assignee: USERS.david,
    dueDate: "2026-11-12",
    subtasks: [
      { id: "st-1", title: "Setup headless Chrome audit script", completed: true },
      { id: "st-2", title: "Collect initial memory profiles", completed: true },
      { id: "st-3", title: "Document asset chunking bottlenecks", completed: false },
      { id: "st-4", title: "Propose tree-shaking improvements", completed: false }
    ],
    commentsCount: 2,
    weight: 3
  },
  {
    id: "task-2",
    key: "CMD-102",
    title: "Implement WebAuthn biometrics login fallback",
    description: "Provide passkey login support with graceful fallback to TOTP authentication on legacy devices.",
    category: "Security",
    priority: "medium",
    status: "backlog",
    assignee: USERS.sarah,
    dueDate: "2026-11-18",
    subtasks: [
      { id: "st-5", title: "Evaluate FIDO2 navigator credentials API", completed: true },
      { id: "st-6", title: "Create fallback modal UI", completed: false },
      { id: "st-7", title: "Integrate backend challenge verification", completed: false }
    ],
    commentsCount: 5,
    weight: 5
  },
  {
    id: "task-3",
    key: "CMD-103",
    title: "Redesign User Profile & Notification Matrix",
    description: "Modernize settings layout with multi-channel toggle switches, avatar cropping, and timezone selector.",
    category: "UI/UX",
    priority: "high",
    status: "todo",
    assignee: USERS.alex,
    dueDate: "2026-10-30",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    subtasks: [
      { id: "st-8", title: "Figma wireframe approval", completed: true },
      { id: "st-9", title: "Accessible focus states implementation", completed: true },
      { id: "st-10", title: "Notification preference tabs", completed: true },
      { id: "st-11", title: "Profile picture avatar upload preview", completed: false },
      { id: "st-12", title: "User testing and accessibility review", completed: false }
    ],
    commentsCount: 8,
    attachmentsCount: 3,
    weight: 8
  },
  {
    id: "task-4",
    key: "CMD-104",
    title: "Setup automated visual regression test suite",
    description: "Configure Playwright test harness for pixel-perfect component snapshots across desktop and mobile breakpoints.",
    category: "Testing",
    priority: "medium",
    status: "todo",
    assignee: USERS.emily,
    dueDate: "2026-11-02",
    subtasks: [
      { id: "st-13", title: "Define baseline snapshot folder", completed: false },
      { id: "st-14", title: "CI workflow integration", completed: false },
      { id: "st-15", title: "Report threshold tolerance setup", completed: false }
    ],
    commentsCount: 3,
    weight: 5
  },
  {
    id: "task-5",
    key: "CMD-105",
    title: "Integrate real-time collaborative cursors and presence",
    description: "Synchronize active board viewers and highlight task card cards currently being edited by other team members.",
    category: "Backend",
    priority: "urgent",
    status: "in_progress",
    assignee: USERS.david,
    dueDate: "2026-10-28",
    subtasks: [
      { id: "st-16", title: "Heartbeat protocol specification", completed: true },
      { id: "st-17", title: "State broadcast debounce", completed: true },
      { id: "st-18", title: "Conflict resolution on rapid drag", completed: false },
      { id: "st-19", title: "Connection recovery retry handler", completed: false }
    ],
    commentsCount: 14,
    attachmentsCount: 2,
    isBlocked: true,
    blockerReason: "Awaiting Core Auth WebSocket endpoint rate-limit approval.",
    weight: 13
  },
  {
    id: "task-6",
    key: "CMD-106",
    title: "Dark mode high-contrast token compliance review",
    description: "Ensure all borders, text colors, and elevation surfaces meet WCAG 2.1 AA standards (minimum 4.5:1 ratio).",
    category: "Design System",
    priority: "high",
    status: "in_progress",
    assignee: USERS.sarah,
    dueDate: "2026-10-29",
    subtasks: [
      { id: "st-20", title: "Primary sidebar contrast check", completed: true },
      { id: "st-21", title: "Kanban column background tokens", completed: true },
      { id: "st-22", title: "Badge and pill color normalization", completed: true },
      { id: "st-23", title: "Dropdown menu border sharpness", completed: true },
      { id: "st-24", title: "Color blindness simulator pass", completed: false }
    ],
    commentsCount: 6,
    weight: 5
  },
  {
    id: "task-7",
    key: "CMD-107",
    title: "Refactor global cache layer with TanStack Query v5",
    description: "Migrate legacy state listeners to query client hooks with optimistic mutation rollbacks.",
    category: "Architecture",
    priority: "high",
    status: "done",
    assignee: USERS.david,
    dueDate: "2026-10-22",
    subtasks: [
      { id: "st-25", title: "Query key factory setup", completed: true },
      { id: "st-26", title: "Mutation rollback on network drop", completed: true },
      { id: "st-27", title: "Cache invalidation listeners", completed: true },
      { id: "st-28", title: "Integration unit tests", completed: true }
    ],
    commentsCount: 9,
    weight: 8
  },
  {
    id: "task-8",
    key: "CMD-108",
    title: "Standardize Lucide icons and button hierarchy",
    description: "Replace legacy SVG icons with standardized 18px stroke-1.75 Lucide components across all views.",
    category: "UI/UX",
    priority: "low",
    status: "done",
    assignee: USERS.alex,
    dueDate: "2026-10-20",
    subtasks: [
      { id: "st-29", title: "Icon audit across navigation", completed: true },
      { id: "st-30", title: "Button size scales (sm, md, lg)", completed: true }
    ],
    commentsCount: 4,
    weight: 3
  }
]

export const UPCOMING_DEADLINES = [
  {
    id: "dl-1",
    taskKey: "CMD-105",
    title: "Real-time presence WebSocket",
    dueDate: "Tomorrow, Oct 28",
    urgent: true,
    assignee: USERS.david
  },
  {
    id: "dl-2",
    taskKey: "CMD-106",
    title: "Dark mode contrast review",
    dueDate: "Oct 29",
    urgent: false,
    assignee: USERS.sarah
  },
  {
    id: "dl-3",
    taskKey: "CMD-103",
    title: "User Profile redesign",
    dueDate: "Oct 30",
    urgent: false,
    assignee: USERS.alex
  },
  {
    id: "dl-4",
    taskKey: "CMD-104",
    title: "Playwright regression suite",
    dueDate: "Nov 02",
    urgent: false,
    assignee: USERS.emily
  }
]
