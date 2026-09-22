import test from "node:test"
import assert from "node:assert/strict"
import type { Session } from "./sdk.ts"
import {
  getSessionVisualState,
  filterAndSortSessions,
  extractProjectDirectories,
} from "./session-sort.ts"

const makeSession = (id: string, title: string, updated: number, directory?: string): Session => ({
  id,
  title,
  time: { created: updated - 1000, updated },
  directory: directory || "/projects/app",
})

test("getSessionVisualState: returns thinking when busy or sending", () => {
  const now = 10000000
  const session = makeSession("s1", "Test", now - 1000)

  assert.equal(getSessionVisualState(session, { type: "busy" }, false, undefined, now), "thinking")
  assert.equal(getSessionVisualState(session, { type: "idle" }, true, undefined, now), "thinking")
})

test("getSessionVisualState: returns online when recent or active", () => {
  const now = 10000000
  const recentSession = makeSession("s1", "Test", now - (60 * 60 * 1000)) // 1 hour ago
  const oldSession = makeSession("s2", "Old", now - (10 * 60 * 60 * 1000)) // 10 hours ago

  assert.equal(getSessionVisualState(recentSession, { type: "idle" }, false, undefined, now), "online")
  assert.equal(getSessionVisualState(oldSession, { type: "idle" }, false, "s2", now), "online")
})

test("getSessionVisualState: returns offline when old and not active", () => {
  const now = 10000000
  const oldSession = makeSession("s1", "Test", now - (5 * 60 * 60 * 1000)) // 5 hours ago

  assert.equal(getSessionVisualState(oldSession, { type: "idle" }, false, "s2", now), "offline")
})

test("filterAndSortSessions: filters by query across title and directory", () => {
  const list = [
    makeSession("1", "Fix bug in login", 1000, "/projects/auth"),
    makeSession("2", "Add dashboard view", 2000, "/projects/web"),
    makeSession("3", "Write auth tests", 3000, "/projects/backend"),
  ]

  const res1 = filterAndSortSessions(list, { query: "login" })
  assert.equal(res1.length, 1)
  assert.equal(res1[0].id, "1")

  const res2 = filterAndSortSessions(list, { query: "auth" })
  assert.equal(res2.length, 2)
  assert.deepEqual(res2.map((s) => s.id), ["3", "1"])
})

test("filterAndSortSessions: sorts by date, name, and status with pinned sessions first", () => {
  const now = 10000000
  const s1 = makeSession("1", "Charlie", now - 3000)
  const s2 = makeSession("2", "Alice", now - 1000)
  const s3 = makeSession("3", "Bob", now - 2000)

  // date-desc
  const byDateDesc = filterAndSortSessions([s1, s2, s3], { sort: "date-desc" })
  assert.deepEqual(byDateDesc.map((s) => s.id), ["2", "3", "1"])

  // date-asc
  const byDateAsc = filterAndSortSessions([s1, s2, s3], { sort: "date-asc" })
  assert.deepEqual(byDateAsc.map((s) => s.id), ["1", "3", "2"])

  // name-asc
  const byNameAsc = filterAndSortSessions([s1, s2, s3], { sort: "name-asc" })
  assert.deepEqual(byNameAsc.map((s) => s.id), ["2", "3", "1"])

  // with pinned
  const withPinned = filterAndSortSessions([s1, s2, s3], {
    sort: "date-desc",
    pinnedIds: ["1"], // Charlie is pinned
  })
  assert.deepEqual(withPinned.map((s) => s.id), ["1", "2", "3"])

  // by status (thinking > online > offline)
  const sBusy = makeSession("b", "Busy", now - 5000)
  const sOnline = makeSession("o", "Online", now - 1000) // 1s ago (< 4h)
  const sOffline = makeSession("off", "Offline", now - (5 * 60 * 60 * 1000)) // 5h ago (> 4h)

  const byStatus = filterAndSortSessions([sOffline, sOnline, sBusy], {
    sort: "status",
    sessionStatusMap: { b: { type: "busy" } },
    nowMs: now,
  })
  assert.deepEqual(byStatus.map((s) => s.id), ["b", "o", "off"])
})

test("extractProjectDirectories & directoryFilter: extracts dirs and filters by selected dir", () => {
  const list = [
    makeSession("1", "A", 1000, "/projects/projA"),
    makeSession("2", "B", 2000, "/projects/projB"),
    makeSession("3", "C", 3000, "/projects/projA"),
  ]

  const dirs = extractProjectDirectories(list)
  assert.deepEqual(dirs, ["/projects/projA", "/projects/projB"])

  const filtered = filterAndSortSessions(list, { directoryFilter: "/projects/projA" })
  assert.equal(filtered.length, 2)
  assert.deepEqual(filtered.map((s) => s.id), ["3", "1"])
})
