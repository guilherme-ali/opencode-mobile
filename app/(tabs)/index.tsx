import { useCallback, useMemo, useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  AppState,
} from "react-native"
import { router, useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useSessions } from "../../src/stores/sessions"
import { useConnections } from "../../src/stores/connections"
import { useEvents } from "../../src/stores/events"
import { useCatalog } from "../../src/stores/catalog"
import type BottomSheet from "@gorhom/bottom-sheet"
import type { Session, Project } from "../../src/lib/sdk"
import { DirectorySwitcher, DirectoryBrowserSheet } from "../../src/components/chat"
import { groupByDirectory } from "../../src/lib/session-grouping"
import { UpdateBanner } from "../../src/components/UpdateBanner"
import { nameOf } from "../../src/lib/path-utils"
import { SETUP_GUIDE_URL } from "../../src/lib/links"
import {
  filterAndSortSessions,
  getSessionVisualState,
  extractProjectDirectories,
  type SessionSortOption,
  type SessionVisualState,
} from "../../src/lib/session-sort"

const PINNED_STORAGE_KEY = "@opencode/pinned_sessions"
const SORT_STORAGE_KEY = "@opencode/session_sort"

function formatTime(timestamp: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return t("sessionsList.time.justNow")
  if (diff < 3600000) return t("sessionsList.time.minutesAgo", { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return t("sessionsList.time.hoursAgo", { count: Math.floor(diff / 3600000) })
  if (diff < 604800000) return t("sessionsList.time.daysAgo", { count: Math.floor(diff / 86400000) })

  return date.toLocaleDateString()
}

function SessionItem({
  session,
  isDark,
  isPinned,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onOpenMenu,
}: {
  session: Session
  isDark: boolean
  isPinned: boolean
  isSelectionMode: boolean
  isSelected: boolean
  onToggleSelect: () => void
  onOpenMenu: () => void
}) {
  const { t } = useTranslation()

  const sessionStatus = useEvents((s) => s.sessionStatus[session.id])
  const isSending = useSessions((s) => s.sending[session.id])
  const activeSessionID = useSessions((s) => s.currentSession?.id)

  const visualState: SessionVisualState = getSessionVisualState(
    session,
    sessionStatus,
    isSending,
    activeSessionID,
  )

  const onPress = () => {
    if (isSelectionMode) {
      onToggleSelect()
    } else {
      router.push({
        pathname: `/session/[id]`,
        params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
      })
    }
  }

  // Extract short directory name from session
  const shortDir = session.directory ? session.directory.split("/").filter(Boolean).pop() : null

  return (
    <TouchableOpacity
      style={[
        styles.sessionItem,
        isDark && styles.sessionItemDark,
        isSelected && (isDark ? styles.sessionItemSelectedDark : styles.sessionItemSelected),
      ]}
      onPress={onPress}
      onLongPress={isSelectionMode ? onToggleSelect : onOpenMenu}
      testID={`session-item-${session.id}`}
      activeOpacity={0.7}
    >
      {isSelectionMode && (
        <View style={styles.checkboxContainer}>
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={22}
            color={isSelected ? "#8b5cf6" : isDark ? "#666666" : "#aaaaaa"}
          />
        </View>
      )}

      <View style={styles.sessionContent}>
        <View style={styles.sessionHeader}>
          {isPinned && (
            <Ionicons name="pin" size={13} color="#8b5cf6" style={{ marginRight: 5 }} />
          )}
          <Text style={[styles.sessionTitle, isDark && styles.textDark]} numberOfLines={1}>
            {session.title || t("sessionsList.untitledSession")}
          </Text>

          {/* Visual Status Indicator: Blue (Thinking), Green (Online), Red (Offline) */}
          <View
            style={[
              styles.statusBadge,
              styles[`statusBadge_${visualState}`],
              isDark && styles[`statusBadgeDark_${visualState}`],
            ]}
          >
            {visualState === "thinking" ? (
              <ActivityIndicator
                size="small"
                color="#3b82f6"
                style={{ width: 10, height: 10, marginRight: 3, transform: [{ scale: 0.6 }] }}
              />
            ) : (
              <View style={[styles.statusDot, styles[`statusDot_${visualState}`]]} />
            )}
            <Text
              style={[
                styles.statusText,
                styles[`statusText_${visualState}`],
                isDark && styles[`statusTextDark_${visualState}`],
              ]}
            >
              {visualState === "thinking"
                ? t("sessionsList.status.thinking", "Pensando...")
                : visualState === "online"
                  ? t("sessionsList.status.online", "Ligado")
                  : t("sessionsList.status.offline", "Desligado")}
            </Text>
          </View>
        </View>
        <View style={styles.sessionMetaRow}>
          <Text style={[styles.sessionMeta, isDark && styles.metaDark]}>
            {formatTime(session.time.updated, t)}
            {/* summary is always present but files defaults to 0 until the
                server populates it — only show the count when it's meaningful,
                matching the SessionInfo panel's `summary.files > 0` guard (#55) */}
            {session.summary && session.summary.files > 0 &&
              ` · ${t("sessionsList.filesCount", { count: session.summary.files })}`}
          </Text>
          {shortDir && (
            <View style={styles.sessionDirBadge}>
              <Ionicons name="folder-outline" size={12} color={isDark ? "#888888" : "#666666"} />
              <Text style={[styles.sessionDirText, isDark && styles.metaDark]}>{shortDir}</Text>
            </View>
          )}
        </View>
      </View>

      {!isSelectionMode && (
        <TouchableOpacity onPress={onOpenMenu} hitSlop={12} style={styles.menuTrigger}>
          <Ionicons name="ellipsis-vertical" size={16} color={isDark ? "#666666" : "#aaaaaa"} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

// Flattened list row — either a collapsible group header or a session.
// A single flat array keeps FlatList's refresh/empty-state handling as-is
// instead of switching to SectionList.
type ListRow =
  | { type: "header"; directory: string; shortName: string; count: number; collapsed: boolean }
  | { type: "session"; session: Session }

function GroupHeader({
  row,
  isDark,
  onToggle,
}: {
  row: { directory: string; shortName: string; count: number; collapsed: boolean }
  isDark: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.groupHeader, isDark && styles.groupHeaderDark]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Ionicons name="folder-outline" size={16} color={isDark ? "#8b5cf6" : "#6d28d9"} />
      <Text style={[styles.groupHeaderText, isDark && styles.textDark]} numberOfLines={1}>
        {row.shortName}
      </Text>
      <Text style={[styles.groupHeaderCount, isDark && styles.metaDark]}>{row.count}</Text>
      <Ionicons
        name={row.collapsed ? "chevron-forward" : "chevron-down"}
        size={16}
        color={isDark ? "#666666" : "#999999"}
      />
    </TouchableOpacity>
  )
}

// Get short directory name (last folder or project name)
function getShortPath(
  project: { path?: { cwd?: string; root?: string; absolute?: string }; name?: string } | null | undefined,
): string {
  if (!project) return ""
  if (project.name) return project.name
  if (!project.path?.absolute) return ""
  const parts = project.path.absolute.split("/").filter(Boolean)
  return parts[parts.length - 1] || project.path.absolute
}

export default function SessionsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()
  const [showNewSession, setShowNewSession] = useState(false)
  const [customDir, setCustomDir] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [renaming, setRenaming] = useState<Session | null>(null)
  const [renameText, setRenameText] = useState("")
  const renamingInFlight = useRef(false)
  // Synchronous re-entrancy guard: `isCreating` state lags by a render, so a
  // fast double-tap on the FAB / "Use this folder" would fire two session
  // creates before the disabled state lands. This blocks the second call.
  const creatingInFlight = useRef(false)
  const [serverProjects, setServerProjects] = useState<Project[]>([])

  const { sessions, isLoading, error, loadSessions, createSession, deleteSession } = useSessions()
  const {
    activeConnection,
    client,
    currentProject,
    serverHome,
    refreshProject,
    clientForDirectory,
    switchDirectory,
    addRecentDirectory,
    recentDirectories,
  } = useConnections()
  const authError = useEvents((s) => s.authError)
  const reconnect = useEvents((s) => s.connect)
  const loadCatalog = useCatalog((s) => s.load)
  const dirSheetRef = useRef<BottomSheet>(null)
  const browserSheetRef = useRef<BottomSheet>(null)
  const [browseStartDir, setBrowseStartDir] = useState<string | null>(null)
  // Shared folder browser is opened either to pick a directory for a new
  // session, or to switch the active connection's directory.
  const [browseMode, setBrowseMode] = useState<"create" | "switch">("create")
  const [refreshing, setRefreshing] = useState(false)
  // Directories collapsed in the grouped session list. Empty by default —
  // all groups start expanded (#67).
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())

  const [searchQuery, setSearchQuery] = useState("")
  const [sortOption, setSortOption] = useState<SessionSortOption>("date-desc")
  const [showSortModal, setShowSortModal] = useState(false)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())

  // Project filtering & Batch selection states
  const [selectedProjectDir, setSelectedProjectDir] = useState<string | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionSession, setActionSession] = useState<Session | null>(null)
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  // Load persisted pinned sessions and sort preference
  useEffect(() => {
    AsyncStorage.getItem(PINNED_STORAGE_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data)
          if (Array.isArray(parsed)) setPinnedIds(new Set(parsed))
        } catch {}
      }
    })
    AsyncStorage.getItem(SORT_STORAGE_KEY).then((val) => {
      if (val && ["date-desc", "date-asc", "name-asc", "name-desc", "status"].includes(val)) {
        setSortOption(val as SessionSortOption)
      }
    })
  }, [])

  const handleTogglePin = useCallback((sessionID: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionID)) {
        next.delete(sessionID)
      } else {
        next.add(sessionID)
      }
      void AsyncStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }, [])

  const handleSelectSort = useCallback((option: SessionSortOption) => {
    setSortOption(option)
    setShowSortModal(false)
    void AsyncStorage.setItem(SORT_STORAGE_KEY, option)
  }, [])

  const handleToggleSelect = useCallback((sessionID: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionID)) {
        next.delete(sessionID)
      } else {
        next.add(sessionID)
      }
      return next
    })
  }, [])

  const sessionStatusMap = useEvents((s) => s.sessionStatus)
  const sendingMap = useSessions((s) => s.sending)
  const currentSession = useSessions((s) => s.currentSession)

  const projectDirectories = useMemo(() => extractProjectDirectories(sessions), [sessions])

  const toggleGroup = useCallback((directory: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(directory)) next.delete(directory)
      else next.add(directory)
      return next
    })
  }, [])

  // Filter and sort sessions, then group by directory
  const sortedFiltered = useMemo(() => {
    return filterAndSortSessions(sessions, {
      query: searchQuery,
      sort: sortOption,
      pinnedIds,
      sessionStatusMap,
      sendingMap,
      activeSessionID: currentSession?.id,
      directoryFilter: selectedProjectDir,
    })
  }, [sessions, searchQuery, sortOption, pinnedIds, sessionStatusMap, sendingMap, currentSession, selectedProjectDir])

  const rows = useMemo<ListRow[]>(() => {
    if (isSelectionMode || selectedProjectDir) {
      return sortedFiltered.map((session) => ({ type: "session", session }))
    }

    const groups = groupByDirectory(sortedFiltered)
    if (groups.length <= 1) {
      return sortedFiltered.map((session) => ({ type: "session", session }))
    }
    const out: ListRow[] = []
    for (const group of groups) {
      const collapsed = collapsedDirs.has(group.directory)
      out.push({
        type: "header",
        directory: group.directory,
        shortName: nameOf(group.directory) || group.directory,
        count: group.items.length,
        collapsed,
      })
      if (!collapsed) {
        for (const session of group.items) out.push({ type: "session", session })
      }
    }
    return out
  }, [sortedFiltered, isSelectionMode, selectedProjectDir, collapsedDirs])

  // Fetch server-known projects when the new session modal opens
  useEffect(() => {
    if (!showNewSession || !client) return
    client.project
      .list()
      .then(setServerProjects)
      .catch(() => setServerProjects([]))
  }, [showNewSession, client])

  const handleSwitchDirectory = useCallback(
    async (dir?: string) => {
      await switchDirectory(dir)
      loadSessions()
      refreshProject()
      loadCatalog()
    },
    [switchDirectory, loadSessions, refreshProject, loadCatalog],
  )

  useFocusEffect(
    useCallback(() => {
      if (client) {
        loadSessions()
        refreshProject()
      }

      let active = true
      const interval = setInterval(() => {
        if (!active) return
        if (AppState.currentState === "active" && client) {
          loadSessions()
        }
      }, 6000)

      return () => {
        active = false
        clearInterval(interval)
      }
    }, [client, loadSessions, refreshProject]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadSessions(), refreshProject()])
    } catch (err) {
      console.error("Refresh failed:", err)
    } finally {
      setRefreshing(false)
    }
  }, [loadSessions, refreshProject])

  const handleRename = useCallback((session: Session) => {
    setRenameText(session.title || "")
    setRenaming(session)
  }, [])

  const submitRename = useCallback(async () => {
    const title = renameText.trim()
    if (!title || !renaming || renamingInFlight.current) return
    const renameClient = renaming.directory ? (clientForDirectory(renaming.directory) ?? client) : client
    if (!renameClient) return
    renamingInFlight.current = true
    try {
      await renameClient.session.update(renaming.id, { title })
      setRenaming(null)
      setRenameText("")
      loadSessions()
    } catch (err) {
      console.error("Rename failed:", err)
      Alert.alert(t("sessionsList.alerts.renameFailedTitle"), t("sessionsList.alerts.renameFailedMessage"))
    } finally {
      renamingInFlight.current = false
    }
  }, [renaming, renameText, client, clientForDirectory, loadSessions, t])

  const handleDelete = useCallback(
    (session: Session) => {
      Alert.alert(
        t("sessionsList.alerts.deleteTitle"),
        t("sessionsList.alerts.deleteMessage", { title: session.title || t("sessionsList.untitledSession") }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await deleteSession(session.id)
              } catch (err) {
                console.error("Delete failed:", err)
                Alert.alert(t("sessionsList.alerts.deleteFailedTitle"), t("sessionsList.alerts.deleteFailedMessage"))
              }
            },
          },
        ],
      )
    },
    [deleteSession, t],
  )

  const onCreateSession = async () => {
    if (creatingInFlight.current) return
    creatingInFlight.current = true
    try {
      const session = await createSession()
      if (session) {
        router.push({
          pathname: `/session/[id]`,
          params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
        })
      } else {
        Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
      }
    } finally {
      creatingInFlight.current = false
    }
  }

  const onCreateInDirectory = async (dir?: string) => {
    if (!activeConnection) return
    if (creatingInFlight.current) return
    creatingInFlight.current = true
    setIsCreating(true)

    try {
      // If a custom directory is specified, use a one-off client for that directory
      // so we don't mutate the connection's default project
      if (dir && dir.trim()) {
        const dirClient = clientForDirectory(dir.trim())
        if (!dirClient) return
        try {
          const session = await dirClient.session.create({})
          addRecentDirectory(dir.trim())
          setShowNewSession(false)
          setCustomDir("")
          if (session) {
            router.push({
              pathname: `/session/[id]`,
              params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
            })
          }
        } catch (error) {
          console.error("Failed to create session in directory:", error)
          Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
        }
        return
      }

      const session = await createSession()
      setShowNewSession(false)
      setCustomDir("")
      if (session) {
        router.push({
          pathname: `/session/[id]`,
          params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
        })
      } else {
        Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
      }
    } finally {
      creatingInFlight.current = false
      setIsCreating(false)
    }
  }

  // The browser sheet is a sibling of the New Session <Modal>. A native RN
  // Modal layers above everything in the React root (including bottom-sheet
  // portals), so the modal must be closed before the sheet is shown; this ref
  // remembers to bring it back if the user cancels without picking a folder.
  const restoreNewSessionOnDismiss = useRef(false)

  const openBrowser = useCallback(
    (startDir: string | null, mode: "create" | "switch") => {
      setBrowseStartDir(startDir || serverHome || null)
      setBrowseMode(mode)
      if (mode === "create" && showNewSession) {
        restoreNewSessionOnDismiss.current = true
        setShowNewSession(false)
      }
      browserSheetRef.current?.expand()
    },
    [serverHome, showNewSession],
  )

  const onBrowserSelect = useCallback(
    (directory: string) => {
      restoreNewSessionOnDismiss.current = false
      if (browseMode === "switch") {
        handleSwitchDirectory(directory)
        dirSheetRef.current?.close()
      } else {
        onCreateInDirectory(directory)
      }
    },
    [browseMode, handleSwitchDirectory, onCreateInDirectory],
  )

  const onBrowserDismiss = useCallback(() => {
    if (restoreNewSessionOnDismiss.current) {
      restoreNewSessionOnDismiss.current = false
      setShowNewSession(true)
    }
  }, [])

  const onFabPress = () => {
    // Quick create in current project
    onCreateSession()
  }

  const onFabLongPress = () => {
    // Show modal with more options
    setCustomDir("")
    setShowNewSession(true)
  }

  if (!activeConnection) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.containerDark]}>
        <Ionicons name="server-outline" size={64} color={isDark ? "#444444" : "#cccccc"} />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>{t("sessionsList.empty.noConnectionTitle")}</Text>
        <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
          {t("sessionsList.empty.noConnectionSubtitle")}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, isDark && styles.addButtonDark]}
          onPress={() => router.push("/connection/add")}
          testID="add-connection-button"
        >
          <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>
            {t("sessionsList.empty.addConnectionButton")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.setupGuideLink}
          onPress={() => Linking.openURL(SETUP_GUIDE_URL)}
          testID="setup-guide-link"
        >
          <Text style={styles.setupGuideLinkText}>{t("sessionsList.empty.setupGuideLink")}</Text>
        </TouchableOpacity>
        {/* No-server activation path (retention): a fully offline scripted
            demo, isolated from real connect/session state — see app/demo.tsx. */}
        <TouchableOpacity
          style={[styles.tryDemoButton, isDark && styles.tryDemoButtonDark]}
          onPress={() => router.push("/demo")}
          testID="try-demo-button"
        >
          <Ionicons name="play-circle-outline" size={16} color={isDark ? "#a78bfa" : "#6d28d9"} />
          <Text style={[styles.tryDemoButtonText, isDark && styles.tryDemoButtonTextDark]}>
            {t("sessionsList.empty.tryDemoButton")}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  // The SSE loop stopped retrying because the server rejected our
  // credentials (401/403) — no amount of pull-to-refresh fixes that, so
  // point the user straight at the fix instead of a spinner that never
  // resolves (issue #76).
  if (authError) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.containerDark]}>
        <Ionicons name="lock-closed-outline" size={64} color={isDark ? "#444444" : "#cccccc"} />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>{t("sessionsList.empty.authFailedTitle")}</Text>
        <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
          {t("sessionsList.empty.authFailedSubtitle", { name: activeConnection.name })}
        </Text>
        <View style={styles.authErrorButtonRow}>
          <TouchableOpacity
            style={[styles.addButton, isDark && styles.addButtonDark]}
            onPress={() => router.push(`/connection/${activeConnection.id}`)}
            testID="fix-connection-button"
          >
            <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>
              {t("sessionsList.empty.checkCredentialsButton")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, isDark && styles.addButtonDark]}
            onPress={() => {
              // authError is cleared inside connect() itself once the retry
              // attempt starts (see src/stores/events.ts), so a manual
              // set() here isn't needed — just kick the SSE state machine.
              reconnect()
            }}
            testID="retry-connection-button"
          >
            <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const shortPath = getShortPath(currentProject)

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Connection indicator — tap to switch project */}
      <TouchableOpacity
        style={[styles.connectionBar, isDark && styles.connectionBarDark]}
        onPress={() => dirSheetRef.current?.expand()}
        onLongPress={() => router.push("/(tabs)/connections")}
        activeOpacity={0.7}
        testID="connection-status-bar"
      >
        <View style={styles.connectionInfo}>
          <View style={[styles.connectionDot, { backgroundColor: "#22c55e" }]} testID="connection-status-dot" />
          <Text style={[styles.connectionName, isDark && styles.textDark]} numberOfLines={1}>
            {activeConnection.name}
          </Text>
          {shortPath && (
            <>
              <Ionicons name="folder" size={14} color={isDark ? "#888888" : "#666666"} />
              <Text style={[styles.projectPath, isDark && styles.metaDark]} numberOfLines={1}>
                {shortPath}
              </Text>
            </>
          )}
        </View>
        <Ionicons name="swap-horizontal-outline" size={16} color={isDark ? "#666666" : "#999999"} />
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <UpdateBanner isDark={isDark} />

      {/* Search & Sort & Selection Row */}
      {sessions.length > 0 && (
        <View style={styles.searchSortContainer}>
          {isSelectionMode ? (
            <View style={styles.selectionModeBar}>
              <View style={styles.selectionLeft}>
                <Text style={[styles.selectionCountText, isDark && styles.textDark]}>
                  {t("sessionsList.selection.selectedCount", { count: selectedIds.size })}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (selectedIds.size === sortedFiltered.length) {
                      setSelectedIds(new Set())
                    } else {
                      setSelectedIds(new Set(sortedFiltered.map((s) => s.id)))
                    }
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.selectAllBtn}>
                    {selectedIds.size === sortedFiltered.length
                      ? t("sessionsList.selection.clearAll", "Desmarcar todas")
                      : t("sessionsList.selection.selectAll", "Selecionar todas")}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.cancelSelectionBtn}
                onPress={() => {
                  setIsSelectionMode(false)
                  setSelectedIds(new Set())
                }}
                hitSlop={6}
              >
                <Text style={[styles.cancelSelectionText, isDark && styles.textDark]}>
                  {t("sessionsList.selection.cancel", "Cancelar")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.searchSortRow}>
              <View style={[styles.searchRow, isDark && styles.searchRowDark]}>
                <Ionicons name="search-outline" size={16} color={isDark ? "#888888" : "#666666"} />
                <TextInput
                  style={[styles.searchInput, isDark && styles.textDark]}
                  placeholder={t("sessionsList.searchPlaceholder", "Search sessions...")}
                  placeholderTextColor={isDark ? "#666666" : "#999999"}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={isDark ? "#888888" : "#666666"} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.sortButton, isDark && styles.sortButtonDark]}
                onPress={() => setShowSortModal(true)}
                hitSlop={6}
              >
                <Ionicons name="swap-vertical" size={15} color={isDark ? "#a78bfa" : "#7c3aed"} />
                <Text style={[styles.sortButtonText, isDark && styles.sortButtonTextDark]} numberOfLines={1}>
                  {sortOption === "date-desc"
                    ? t("sessionsList.sort.dateDesc")
                    : sortOption === "date-asc"
                      ? t("sessionsList.sort.dateAsc")
                      : sortOption === "name-asc"
                        ? t("sessionsList.sort.nameAsc")
                        : sortOption === "name-desc"
                          ? t("sessionsList.sort.nameDesc")
                          : t("sessionsList.sort.status")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconButton, isDark && styles.iconButtonDark]}
                onPress={() => setIsSelectionMode(true)}
                hitSlop={6}
              >
                <Ionicons name="checkbox-outline" size={17} color={isDark ? "#a78bfa" : "#7c3aed"} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Project Chips (Horizontal scrollable bar) */}
      {!isSelectionMode && projectDirectories.length > 1 && (
        <View style={styles.chipsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.chip,
                isDark && styles.chipDark,
                selectedProjectDir === null && styles.chipActive,
              ]}
              onPress={() => setSelectedProjectDir(null)}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.chipText,
                  isDark && styles.chipTextDark,
                  selectedProjectDir === null && styles.chipTextActive,
                ]}
              >
                {t("sessionsList.projects.all", "Todos")} ({sessions.length})
              </Text>
            </TouchableOpacity>

            {projectDirectories.map((dir) => {
              const active = selectedProjectDir === dir
              const name = nameOf(dir) || dir
              const count = sessions.filter((s) => s.directory === dir).length
              return (
                <TouchableOpacity
                  key={dir}
                  style={[
                    styles.chip,
                    isDark && styles.chipDark,
                    active && styles.chipActive,
                  ]}
                  onPress={() => setSelectedProjectDir(active ? null : dir)}
                  hitSlop={4}
                >
                  <Ionicons
                    name="folder-outline"
                    size={12}
                    color={active ? "#ffffff" : isDark ? "#888888" : "#666666"}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      isDark && styles.chipTextDark,
                      active && styles.chipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {name} ({count})
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(row) => (row.type === "header" ? `dir:${row.directory}` : row.session.id)}
        renderItem={({ item: row }) =>
          row.type === "header" ? (
            <GroupHeader row={row} isDark={isDark} onToggle={() => toggleGroup(row.directory)} />
          ) : (
            <SessionItem
              session={row.session}
              isDark={isDark}
              isPinned={pinnedIds.has(row.session.id)}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(row.session.id)}
              onToggleSelect={() => handleToggleSelect(row.session.id)}
              onOpenMenu={() => setActionSession(row.session)}
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? "#ffffff" : "#0a0a0a"} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#0a0a0a"} />
            </View>
          ) : (
            <View style={styles.emptyList}>
              <Text style={[styles.emptyListText, isDark && styles.metaDark]}>
                {searchQuery.trim()
                  ? t("sessionsList.empty.noMatchingSessions", "No matching sessions found")
                  : t("sessionsList.empty.noSessions")}
              </Text>
            </View>
          )
        }
        contentContainerStyle={sessions.length === 0 ? styles.emptyContent : undefined}
      />

      {/* Floating Batch Delete Action Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={[styles.floatingBatchBar, isDark && styles.floatingBatchBarDark]}>
          <TouchableOpacity
            style={styles.batchDeleteBtn}
            onPress={() => setShowBatchDeleteConfirm(true)}
            activeOpacity={0.8}
            disabled={isDeletingBatch}
          >
            {isDeletingBatch ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="trash" size={17} color="#ffffff" />
                <Text style={styles.batchDeleteBtnText}>
                  {t("sessionsList.selection.deleteSelected", { count: selectedIds.size })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* FAB to create new session */}
      <TouchableOpacity
        style={[styles.fab, isDark && styles.fabDark]}
        onPress={onFabPress}
        onLongPress={onFabLongPress}
        delayLongPress={500}
        testID="new-session-fab"
      >
        <Ionicons name="add" size={28} color={isDark ? "#0a0a0a" : "#ffffff"} />
      </TouchableOpacity>

      {/* New Session Info Modal */}
      <Modal visible={showNewSession} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setShowNewSession(false)} />
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>{t("sessionsList.newSessionModal.title")}</Text>
              <TouchableOpacity onPress={() => setShowNewSession(false)}>
                <Ionicons name="close" size={24} color={isDark ? "#ffffff" : "#0a0a0a"} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollBody} keyboardShouldPersistTaps="handled">
              {/* Current directory — tapping creates session immediately */}
              <Text style={[styles.modalLabel, isDark && styles.metaDark]}>
                {t("sessionsList.newSessionModal.currentProjectLabel")}
              </Text>
              <TouchableOpacity
                style={[styles.modalDirBox, isDark && styles.modalDirBoxDark]}
                onPress={() => onCreateInDirectory()}
                disabled={isCreating}
              >
                <Ionicons name="folder" size={20} color={isDark ? "#8b5cf6" : "#6d28d9"} />
                <Text style={[styles.modalDirText, isDark && styles.textDark]} numberOfLines={2}>
                  {currentProject?.path?.absolute || activeConnection?.directory || t("sessionsList.newSessionModal.serverDefault")}
                </Text>
                <Ionicons name="arrow-forward-circle" size={20} color={isDark ? "#8b5cf6" : "#6d28d9"} />
              </TouchableOpacity>

              {/* Recent projects */}
              {recentDirectories.length > 0 && (
                <>
                  <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                    {t("sessionsList.newSessionModal.recentProjectsLabel")}
                  </Text>
                  {recentDirectories.map((dir) => {
                    const short = dir.split("/").filter(Boolean).pop() || dir
                    const isCurrent =
                      dir === (currentProject?.path?.absolute || activeConnection?.directory)
                    return (
                      <TouchableOpacity
                        key={dir}
                        style={[
                          styles.projectRow,
                          isDark && styles.projectRowDark,
                          isCurrent && styles.projectRowActive,
                        ]}
                        onPress={() => onCreateInDirectory(dir)}
                        disabled={isCreating}
                      >
                        <Ionicons
                          name="folder-outline"
                          size={18}
                          color={isCurrent ? "#8b5cf6" : isDark ? "#888888" : "#666666"}
                        />
                        <View style={styles.projectRowContent}>
                          <Text
                            style={[
                              styles.projectRowName,
                              isDark && styles.textDark,
                              isCurrent && styles.projectRowNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {short}
                          </Text>
                          <Text style={[styles.projectRowPath, isDark && styles.metaDark]} numberOfLines={1}>
                            {dir}
                          </Text>
                        </View>
                        {isCurrent && <Ionicons name="checkmark-circle" size={18} color="#8b5cf6" />}
                      </TouchableOpacity>
                    )
                  })}
                </>
              )}

              {/* Server-known projects (excluding current) */}
              {serverProjects.filter((p) => p.path?.absolute !== currentProject?.path?.absolute).length > 0 && (
                <>
                  <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                    {t("sessionsList.newSessionModal.serverProjectsLabel")}
                  </Text>
                  {serverProjects
                    .filter((p) => p.path?.absolute !== currentProject?.path?.absolute)
                    .map((p) => {
                      const short = p.name || p.path?.absolute?.split("/").filter(Boolean).pop() || p.id
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.projectRow, isDark && styles.projectRowDark]}
                          onPress={() => onCreateInDirectory(p.path?.absolute)}
                          disabled={isCreating}
                        >
                          <Ionicons name="code-slash-outline" size={18} color={isDark ? "#888888" : "#666666"} />
                          <View style={styles.projectRowContent}>
                            <Text style={[styles.projectRowName, isDark && styles.textDark]} numberOfLines={1}>
                              {short}
                            </Text>
                            {p.path?.absolute && (
                              <Text style={[styles.projectRowPath, isDark && styles.metaDark]} numberOfLines={1}>
                                {p.path.absolute}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                </>
              )}

              {/* Browse the server's filesystem instead of typing a path */}
              <TouchableOpacity
                style={[styles.projectRow, isDark && styles.projectRowDark, { marginTop: 16 }]}
                onPress={() =>
                  openBrowser(currentProject?.path?.absolute || activeConnection?.directory || null, "create")
                }
                disabled={isCreating}
                testID="browse-folders-button"
              >
                <Ionicons name="folder-open-outline" size={18} color={isDark ? "#8b5cf6" : "#6d28d9"} />
                <View style={styles.projectRowContent}>
                  <Text style={[styles.projectRowName, isDark && styles.textDark]}>
                    {t("sessionsList.newSessionModal.browseFoldersLabel")}
                  </Text>
                  <Text style={[styles.projectRowPath, isDark && styles.metaDark]}>
                    {t("sessionsList.newSessionModal.browseFoldersHint")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={isDark ? "#666666" : "#999999"} />
              </TouchableOpacity>

              {/* Manual path input fallback */}
              <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                {t("sessionsList.newSessionModal.enterPathLabel")}
              </Text>
              <TextInput
                style={[styles.modalInput, isDark && styles.modalInputDark]}
                placeholder={serverHome ? `${serverHome}/...` : "/path/to/project"}
                placeholderTextColor={isDark ? "#666666" : "#999999"}
                value={customDir}
                onChangeText={(text) => {
                  // Expand ~ to server home directory
                  if (serverHome && text.startsWith("~/")) {
                    setCustomDir(serverHome + text.slice(1))
                  } else if (serverHome && text === "~") {
                    setCustomDir(serverHome)
                  } else {
                    setCustomDir(text)
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {/* Quick path shortcuts */}
              {serverHome && (
                <View style={styles.pathChips}>
                  <TouchableOpacity
                    style={[styles.pathChip, isDark && styles.pathChipDark]}
                    onPress={() => setCustomDir(serverHome)}
                  >
                    <Text style={[styles.pathChipText, isDark && styles.pathChipTextDark]}>~</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pathChip, isDark && styles.pathChipDark]}
                    onPress={() => setCustomDir(serverHome + "/")}
                  >
                    <Text style={[styles.pathChipText, isDark && styles.pathChipTextDark]}>~/</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              {customDir.trim() ? (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    isDark && styles.modalButtonPrimaryDark,
                    styles.modalButtonFull,
                  ]}
                  onPress={() => onCreateInDirectory(customDir)}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={isDark ? "#0a0a0a" : "#ffffff"} />
                  ) : (
                    <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                      {t("sessionsList.newSessionModal.createInButton", {
                        dir: customDir.split("/").filter(Boolean).pop() || customDir,
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    isDark && styles.modalButtonPrimaryDark,
                    styles.modalButtonFull,
                  ]}
                  onPress={() => onCreateInDirectory()}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={isDark ? "#0a0a0a" : "#ffffff"} />
                  ) : (
                    <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                      {t("sessionsList.newSessionModal.createSessionButton")}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rename modal */}
      <Modal visible={!!renaming} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { justifyContent: "center" }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setRenaming(null)} />
          <View style={[styles.renameCard, isDark && styles.renameCardDark]}>
            <Text style={[styles.renameTitle, isDark && styles.textDark]}>{t("sessionsList.renameModal.title")}</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              value={renameText}
              onChangeText={setRenameText}
              onSubmitEditing={submitRename}
              returnKeyType="done"
              autoFocus
              selectTextOnFocus
              autoCapitalize="sentences"
              autoCorrect={false}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity style={[styles.renameBtn, styles.renameBtnCancel]} onPress={() => setRenaming(null)}>
                <Text style={styles.renameBtnCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameBtn, styles.modalButtonPrimary, isDark && styles.modalButtonPrimaryDark]}
                onPress={submitRename}
                disabled={!renameText.trim()}
              >
                <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                  {t("common.save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setRenaming(null)} />
        </KeyboardAvoidingView>
      </Modal>

      {/* Sort selection modal */}
      <Modal visible={showSortModal} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={[styles.sortCard, isDark && styles.sortCardDark]}>
            <Text style={[styles.sortTitle, isDark && styles.textDark]}>{t("sessionsList.sort.title")}</Text>

            {(
              [
                { id: "date-desc", label: t("sessionsList.sort.dateDesc"), icon: "time-outline" },
                { id: "date-asc", label: t("sessionsList.sort.dateAsc"), icon: "arrow-up-outline" },
                { id: "name-asc", label: t("sessionsList.sort.nameAsc"), icon: "text-outline" },
                { id: "name-desc", label: t("sessionsList.sort.nameDesc"), icon: "text-outline" },
                { id: "status", label: t("sessionsList.sort.status"), icon: "pulse-outline" },
              ] as const
            ).map((item) => {
              const selected = sortOption === item.id
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.sortOptionRow,
                    selected && (isDark ? styles.sortOptionRowSelectedDark : styles.sortOptionRowSelected),
                  ]}
                  onPress={() => handleSelectSort(item.id)}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={18}
                    color={selected ? "#8b5cf6" : isDark ? "#888888" : "#666666"}
                  />
                  <Text
                    style={[
                      styles.sortOptionText,
                      isDark && styles.textDark,
                      selected && styles.sortOptionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color="#8b5cf6" />}
                </TouchableOpacity>
              )
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Styled Action Bottom Sheet for Session */}
      <Modal visible={actionSession !== null && !showSingleDeleteConfirm} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionSession(null)}
        >
          <View style={[styles.actionSheetCard, isDark && styles.actionSheetCardDark]}>
            <View style={[styles.sheetHandle, isDark && styles.sheetHandleDark]} />

            {/* Header with Title and Info */}
            <View style={styles.actionSheetHeader}>
              <Text style={[styles.actionSheetTitle, isDark && styles.textDark]} numberOfLines={2}>
                {actionSession?.title || t("sessionsList.untitledSession")}
              </Text>
              <View style={styles.actionSheetMetaRow}>
                {actionSession?.directory && (
                  <View style={[styles.actionSheetBadge, isDark && styles.actionSheetBadgeDark]}>
                    <Ionicons name="folder-outline" size={12} color={isDark ? "#aaaaaa" : "#666666"} />
                    <Text style={[styles.actionSheetBadgeText, isDark && styles.metaDark]}>
                      {nameOf(actionSession.directory) || actionSession.directory}
                    </Text>
                  </View>
                )}
                {actionSession?.time && (
                  <Text style={[styles.actionSheetTime, isDark && styles.metaDark]}>
                    {formatTime(actionSession.time.updated, t)}
                  </Text>
                )}
              </View>
            </View>

            {/* Actions List */}
            <View style={styles.actionSheetButtons}>
              {/* Pin / Unpin */}
              <TouchableOpacity
                style={[styles.actionRow, isDark && styles.actionRowDark]}
                onPress={() => {
                  if (actionSession) {
                    handleTogglePin(actionSession.id)
                    setActionSession(null)
                  }
                }}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "rgba(139, 92, 246, 0.12)" }]}>
                  <Ionicons
                    name={actionSession && pinnedIds.has(actionSession.id) ? "pin" : "pin-outline"}
                    size={18}
                    color="#8b5cf6"
                  />
                </View>
                <Text style={[styles.actionText, isDark && styles.textDark]}>
                  {actionSession && pinnedIds.has(actionSession.id)
                    ? t("sessionsList.actions.unpin")
                    : t("sessionsList.actions.pin")}
                </Text>
              </TouchableOpacity>

              {/* Rename */}
              <TouchableOpacity
                style={[styles.actionRow, isDark && styles.actionRowDark]}
                onPress={() => {
                  if (actionSession) {
                    const sess = actionSession
                    setActionSession(null)
                    handleRename(sess)
                  }
                }}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.12)" }]}>
                  <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
                </View>
                <Text style={[styles.actionText, isDark && styles.textDark]}>
                  {t("sessionsList.actions.rename")}
                </Text>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={[styles.actionRow, isDark && styles.actionRowDark]}
                onPress={() => {
                  setShowSingleDeleteConfirm(true)
                }}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </View>
                <Text style={[styles.actionText, { color: "#ef4444", fontWeight: "600" }]}>
                  {t("common.delete")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={[styles.actionSheetCancelBtn, isDark && styles.actionSheetCancelBtnDark]}
              onPress={() => setActionSession(null)}
            >
              <Text style={[styles.actionSheetCancelText, isDark && styles.textDark]}>
                {t("common.cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Single Delete Confirmation Modal */}
      <Modal visible={showSingleDeleteConfirm} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSingleDeleteConfirm(false)}
        >
          <View style={[styles.confirmCard, isDark && styles.confirmCardDark]}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="alert-circle" size={32} color="#ef4444" />
            </View>
            <Text style={[styles.confirmTitle, isDark && styles.textDark]}>
              {t("sessionsList.actionSheet.deleteConfirmTitle", "Delete Session?")}
            </Text>
            <Text style={[styles.confirmMessage, isDark && styles.metaDark]}>
              {t("sessionsList.actionSheet.deleteConfirmMessage", {
                title: actionSession?.title || t("sessionsList.untitledSession"),
              })}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, isDark && styles.confirmCancelBtnDark]}
                onPress={() => setShowSingleDeleteConfirm(false)}
              >
                <Text style={[styles.confirmCancelText, isDark && styles.textDark]}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={async () => {
                  if (actionSession) {
                    const id = actionSession.id
                    setShowSingleDeleteConfirm(false)
                    setActionSession(null)
                    try {
                      await deleteSession(id)
                    } catch {}
                  }
                }}
              >
                <Text style={styles.confirmDeleteBtnText}>{t("common.delete")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Batch Delete Confirmation Modal */}
      <Modal visible={showBatchDeleteConfirm} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBatchDeleteConfirm(false)}
        >
          <View style={[styles.confirmCard, isDark && styles.confirmCardDark]}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="trash" size={32} color="#ef4444" />
            </View>
            <Text style={[styles.confirmTitle, isDark && styles.textDark]}>
              {t("sessionsList.selection.deleteConfirmTitle", { count: selectedIds.size })}
            </Text>
            <Text style={[styles.confirmMessage, isDark && styles.metaDark]}>
              {t("sessionsList.selection.deleteConfirmMessage")}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, isDark && styles.confirmCancelBtnDark]}
                onPress={() => setShowBatchDeleteConfirm(false)}
                disabled={isDeletingBatch}
              >
                <Text style={[styles.confirmCancelText, isDark && styles.textDark]}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                disabled={isDeletingBatch}
                onPress={async () => {
                  setIsDeletingBatch(true)
                  try {
                    const ids = Array.from(selectedIds)
                    for (const id of ids) {
                      await deleteSession(id)
                    }
                    setSelectedIds(new Set())
                    setIsSelectionMode(false)
                    setShowBatchDeleteConfirm(false)
                    loadSessions()
                  } finally {
                    setIsDeletingBatch(false)
                  }
                }}
              >
                {isDeletingBatch ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>{t("common.delete")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Directory switcher bottom sheet */}
      <DirectorySwitcher
        sheetRef={dirSheetRef}
        current={activeConnection?.directory}
        recents={recentDirectories}
        serverHome={serverHome}
        isDark={isDark}
        onSwitch={handleSwitchDirectory}
        onBrowse={() =>
          openBrowser(activeConnection?.directory || currentProject?.path?.absolute || null, "switch")
        }
      />

      {/* Browsable folder picker — used for both "new session in..." and
          "switch project directory" flows (see browseMode). */}
      <DirectoryBrowserSheet
        sheetRef={browserSheetRef}
        startDirectory={browseStartDir}
        clientForDirectory={clientForDirectory}
        isDark={isDark}
        onSelect={onBrowserSelect}
        onDismiss={onBrowserDismiss}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#0a0a0a",
  },
  connectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  connectionBarDark: {
    borderBottomColor: "#1a1a1a",
  },
  connectionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  connectionUrl: {
    fontSize: 12,
    color: "#666666",
  },
  projectPath: {
    fontSize: 13,
    color: "#666666",
    flex: 1,
  },
  errorBar: {
    backgroundColor: "#fef2f2",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  groupHeaderDark: {
    backgroundColor: "#151515",
    borderBottomColor: "#1a1a1a",
  },
  groupHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  groupHeaderCount: {
    fontSize: 12,
    color: "#666666",
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  sessionItemDark: {
    borderBottomColor: "#1a1a1a",
  },
  sessionContent: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sessionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  checkboxContainer: {
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  menuTrigger: {
    padding: 6,
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  sessionItemSelected: {
    backgroundColor: "#f5f3ff",
    borderColor: "#8b5cf6",
  },
  sessionItemSelectedDark: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "#8b5cf6",
  },
  // Search & Sort bar
  searchSortContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchSortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    backgroundColor: "#f5f5f5",
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  iconButtonDark: {
    backgroundColor: "#161616",
  },
  selectionModeBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 38,
    paddingHorizontal: 4,
  },
  selectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectionCountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0a0a0a",
  },
  selectAllBtn: {
    fontSize: 13,
    color: "#8b5cf6",
    fontWeight: "600",
  },
  cancelSelectionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelSelectionText: {
    fontSize: 13,
    color: "#666666",
    fontWeight: "600",
  },
  // Chips
  chipsContainer: {
    paddingBottom: 8,
  },
  chipsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  chipDark: {
    backgroundColor: "#161616",
    borderColor: "#2a2a2a",
  },
  chipActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  chipText: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "500",
  },
  chipTextDark: {
    color: "#aaaaaa",
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  // Floating batch delete bar
  floatingBatchBar: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  floatingBatchBarDark: {},
  batchDeleteBtn: {
    backgroundColor: "#ef4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  batchDeleteBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  // Action sheet bottom modal
  actionSheetCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 16,
  },
  actionSheetCardDark: {
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#dddddd",
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHandleDark: {
    backgroundColor: "#333333",
  },
  actionSheetHeader: {
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    paddingBottom: 12,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0a0a",
  },
  actionSheetMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionSheetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionSheetBadgeDark: {
    backgroundColor: "#222222",
  },
  actionSheetBadgeText: {
    fontSize: 11,
    color: "#666666",
  },
  actionSheetTime: {
    fontSize: 11,
    color: "#888888",
  },
  actionSheetButtons: {
    gap: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 12,
  },
  actionRowDark: {},
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    fontSize: 15,
    color: "#0a0a0a",
    fontWeight: "600",
  },
  actionSheetCancelBtn: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  actionSheetCancelBtnDark: {
    backgroundColor: "#222222",
  },
  actionSheetCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
  },
  // Confirm cards
  confirmCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 22,
    width: "85%",
    maxWidth: 340,
    alignItems: "center",
    gap: 10,
  },
  confirmCardDark: {
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  confirmIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0a0a0a",
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: 13,
    color: "#666666",
    textAlign: "center",
    lineHeight: 18,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  confirmCancelBtnDark: {
    backgroundColor: "#222222",
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  confirmDeleteBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  searchRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  searchRowDark: {
    backgroundColor: "#161616",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0a0a0a",
    paddingVertical: 0,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 8,
    gap: 4,
  },
  sortButtonDark: {
    backgroundColor: "#161616",
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666666",
  },
  sortButtonTextDark: {
    color: "#aaaaaa",
  },

  // Status badges
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  statusBadge_thinking: {
    backgroundColor: "#eff6ff",
  },
  statusBadgeDark_thinking: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  statusBadge_online: {
    backgroundColor: "#f0fdf4",
  },
  statusBadgeDark_online: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  statusBadge_offline: {
    backgroundColor: "#fef2f2",
  },
  statusBadgeDark_offline: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusDot_online: {
    backgroundColor: "#22c55e",
  },
  statusDot_offline: {
    backgroundColor: "#ef4444",
  },

  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statusText_thinking: {
    color: "#2563eb",
  },
  statusTextDark_thinking: {
    color: "#60a5fa",
  },
  statusText_online: {
    color: "#16a34a",
  },
  statusTextDark_online: {
    color: "#4ade80",
  },
  statusText_offline: {
    color: "#dc2626",
  },
  statusTextDark_offline: {
    color: "#f87171",
  },

  // Sort modal
  sortCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    width: "85%",
    maxWidth: 340,
    gap: 6,
  },
  sortCardDark: {
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  sortTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0a0a",
    marginBottom: 8,
  },
  sortOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 10,
  },
  sortOptionRowSelected: {
    backgroundColor: "#f5f3ff",
  },
  sortOptionRowSelectedDark: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
  },
  sortOptionText: {
    flex: 1,
    fontSize: 13,
    color: "#333333",
  },
  sortOptionTextSelected: {
    color: "#8b5cf6",
    fontWeight: "600",
  },
  textDark: {
    color: "#ffffff",
  },
  sessionMeta: {
    fontSize: 13,
    color: "#666666",
  },
  sessionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionDirBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sessionDirText: {
    fontSize: 11,
    color: "#666666",
  },
  metaDark: {
    color: "#888888",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#ffffff",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    color: "#0a0a0a",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  authErrorButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  addButtonDark: {
    backgroundColor: "#ffffff",
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  addButtonTextDark: {
    color: "#0a0a0a",
  },
  setupGuideLink: {
    marginTop: 16,
  },
  setupGuideLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  },
  tryDemoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  tryDemoButtonDark: {
    borderColor: "#a78bfa",
  },
  tryDemoButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6d28d9",
  },
  tryDemoButtonTextDark: {
    color: "#a78bfa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyListText: {
    fontSize: 16,
    color: "#666666",
  },
  emptyContent: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabDark: {
    backgroundColor: "#ffffff",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalContentDark: {
    backgroundColor: "#1a1a1a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  modalBody: {
    marginBottom: 24,
  },
  modalScrollBody: {
    maxHeight: 420,
    marginBottom: 16,
  },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    marginBottom: 6,
  },
  projectRowDark: {
    backgroundColor: "#2a2a2a",
  },
  projectRowActive: {
    backgroundColor: "#f5f3ff",
  },
  projectRowContent: {
    flex: 1,
  },
  projectRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  projectRowNameActive: {
    color: "#8b5cf6",
  },
  projectRowPath: {
    fontSize: 11,
    color: "#999999",
    marginTop: 1,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  modalDirBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
  },
  modalDirBoxDark: {
    backgroundColor: "#2a2a2a",
  },
  modalDirText: {
    fontSize: 15,
    color: "#0a0a0a",
    flex: 1,
  },
  modalInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0a0a0a",
  },
  modalInputDark: {
    backgroundColor: "#2a2a2a",
    color: "#ffffff",
  },
  pathChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  pathChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#e8e5f0",
    borderRadius: 16,
  },
  pathChipDark: {
    backgroundColor: "#2a2040",
  },
  pathChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6d28d9",
  },
  pathChipTextDark: {
    color: "#c4b5fd",
  },
  modalHint: {
    fontSize: 13,
    color: "#666666",
    marginTop: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  modalButtonSecondary: {
    backgroundColor: "#f5f5f5",
  },
  modalButtonSecondaryDark: {
    backgroundColor: "#2a2a2a",
  },
  modalButtonPrimary: {
    backgroundColor: "#0a0a0a",
  },
  modalButtonPrimaryDark: {
    backgroundColor: "#ffffff",
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  modalButtonTextPrimaryDark: {
    color: "#0a0a0a",
  },
  modalButtonFull: {
    flex: 0,
    width: "100%",
  },
  // Rename modal
  renameCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 32,
    gap: 16,
  },
  renameCardDark: {
    backgroundColor: "#1a1a1a",
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  renameBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  renameBtnCancel: {
    backgroundColor: "transparent",
  },
  renameBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888888",
  },
})
