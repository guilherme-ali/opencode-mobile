import type { Session } from "./sdk"

export type SessionVisualState = "thinking" | "online" | "offline"

export type SessionSortOption =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "status"

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

export function getSessionVisualState(
  session: Session,
  sessionStatus?: { type: string },
  isSending?: boolean,
  activeSessionID?: string,
  nowMs: number = Date.now(),
): SessionVisualState {
  if (sessionStatus?.type === "busy" || isSending) {
    return "thinking"
  }

  const isRecent = nowMs - (session.time?.updated ?? 0) < FOUR_HOURS_MS
  if (session.id === activeSessionID || isRecent) {
    return "online"
  }

  return "offline"
}

const STATUS_PRIORITY: Record<SessionVisualState, number> = {
  thinking: 0,
  online: 1,
  offline: 2,
}

export function filterAndSortSessions(
  sessions: Session[],
  options: {
    query?: string
    sort?: SessionSortOption
    pinnedIds?: string[] | Set<string>
    sessionStatusMap?: Record<string, { type: string }>
    sendingMap?: Record<string, boolean>
    activeSessionID?: string
    nowMs?: number
  } = {},
): Session[] {
  const {
    query = "",
    sort = "date-desc",
    pinnedIds,
    sessionStatusMap = {},
    sendingMap = {},
    activeSessionID,
    nowMs = Date.now(),
  } = options

  const pinnedSet = pinnedIds instanceof Set ? pinnedIds : new Set(pinnedIds || [])
  const trimmedQuery = query.trim().toLowerCase()

  // 1. Filter
  const filtered = sessions.filter((s) => {
    if (!trimmedQuery) return true
    const titleMatch = (s.title || "").toLowerCase().includes(trimmedQuery)
    const dirMatch = (s.directory || "").toLowerCase().includes(trimmedQuery)
    return titleMatch || dirMatch
  })

  // 2. Sort comparator
  const compareItems = (a: Session, b: Session): number => {
    switch (sort) {
      case "date-asc":
        return (a.time?.updated ?? 0) - (b.time?.updated ?? 0)

      case "name-asc":
        return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })

      case "name-desc":
        return (b.title || "").localeCompare(a.title || "", undefined, { sensitivity: "base" })

      case "status": {
        const stateA = getSessionVisualState(
          a,
          sessionStatusMap[a.id],
          sendingMap[a.id],
          activeSessionID,
          nowMs,
        )
        const stateB = getSessionVisualState(
          b,
          sessionStatusMap[b.id],
          sendingMap[b.id],
          activeSessionID,
          nowMs,
        )
        const diff = STATUS_PRIORITY[stateA] - STATUS_PRIORITY[stateB]
        if (diff !== 0) return diff
        // Secondary sort: most recent first
        return (b.time?.updated ?? 0) - (a.time?.updated ?? 0)
      }

      case "date-desc":
      default:
        return (b.time?.updated ?? 0) - (a.time?.updated ?? 0)
    }
  }

  // 3. Separate pinned vs unpinned, sort each group, then concatenate
  if (pinnedSet.size === 0) {
    return [...filtered].sort(compareItems)
  }

  const pinned: Session[] = []
  const unpinned: Session[] = []

  for (const s of filtered) {
    if (pinnedSet.has(s.id)) {
      pinned.push(s)
    } else {
      unpinned.push(s)
    }
  }

  pinned.sort(compareItems)
  unpinned.sort(compareItems)

  return [...pinned, ...unpinned]
}
