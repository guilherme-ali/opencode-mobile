import { useCallback, useEffect, useMemo } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  useColorScheme,
} from "react-native"
import { Stack, useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useQuota } from "../../src/stores/quota"
import { getDetailedProviderQuotas, type QuotaWindow } from "../../src/lib/quota-format"

export default function UsageLimitsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { raw, loading, load, lastFetched } = useQuota()

  // Refresh every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  // Auto-refresh every 10 seconds while this screen is open
  useEffect(() => {
    const timer = setInterval(() => {
      void load()
    }, 10_000)
    return () => clearInterval(timer)
  }, [load])

  const providers = useMemo(() => {
    return getDetailedProviderQuotas(raw)
  }, [raw])

  const lastUpdatedText = useMemo(() => {
    if (!lastFetched) return ""
    const d = new Date(lastFetched)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }, [lastFetched])

  return (
    <>
      <Stack.Screen
        options={{
          title: t("settings.usage.title", "Usos e Limites"),
          headerBackTitle: t("common.back", "Back"),
          headerRight: () => (
            <TouchableOpacity onPress={() => void load()} disabled={loading} hitSlop={8}>
              {loading ? (
                <ActivityIndicator size="small" color={isDark ? "#ffffff" : "#0a0a0a"} />
              ) : (
                <Ionicons name="refresh-outline" size={20} color={isDark ? "#ffffff" : "#0a0a0a"} />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={[s.container, isDark && s.containerDark]}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      >
        {/* Header summary / last updated */}
        <View style={s.topBar}>
          <View style={s.topBarLeft}>
            <Ionicons name="speedometer-outline" size={16} color="#8b5cf6" />
            <Text style={[s.topBarTitle, isDark && s.textWhite]}>
              {t("settings.usage.description")}
            </Text>
          </View>
          {lastUpdatedText ? (
            <Text style={[s.lastUpdatedText, isDark && s.textDim]}>
              {t("settings.usage.lastUpdated", { time: lastUpdatedText })}
            </Text>
          ) : null}
        </View>

        {/* Empty state */}
        {!loading && providers.length === 0 && (
          <View style={s.emptyBox}>
            <Ionicons name="pulse-outline" size={44} color={isDark ? "#444444" : "#cccccc"} />
            <Text style={[s.emptyText, isDark && s.textDim]}>
              {t("settings.usage.emptyNotice")}
            </Text>
          </View>
        )}

        {/* Provider Cards */}
        {providers.map((p) => (
          <View key={p.id} style={[s.card, isDark && s.cardDark]}>
            {/* Provider Header */}
            <View style={[s.cardHeader, isDark && s.cardHeaderDark]}>
              <View style={s.providerTitleRow}>
                <Ionicons
                  name={
                    p.id === "google"
                      ? "logo-google"
                      : p.id === "openai"
                        ? "sparkles"
                        : "cube-outline"
                  }
                  size={18}
                  color="#8b5cf6"
                />
                <Text style={[s.providerName, isDark && s.textWhite]}>{p.name}</Text>
              </View>
              {p.accountLabel ? (
                <Text style={[s.accountBadge, isDark && s.accountBadgeDark]} numberOfLines={1}>
                  {p.accountLabel}
                </Text>
              ) : null}
            </View>

            {/* Quota Windows */}
            <View style={s.cardBody}>
              {p.fiveHour ? (
                <QuotaWindowRow
                  title={t("settings.usage.fiveHour")}
                  window={p.fiveHour}
                  isDark={isDark}
                  t={t}
                />
              ) : null}

              {p.weekly ? (
                <QuotaWindowRow
                  title={t("settings.usage.weekly")}
                  window={p.weekly}
                  isDark={isDark}
                  t={t}
                />
              ) : null}

              {/* Extra pools if present (e.g. Claude via Antigravity) */}
              {p.extraPools?.map((pool) => (
                <View key={pool.name} style={s.extraPoolContainer}>
                  <Text style={[s.extraPoolTitle, isDark && s.textDim]}>{pool.name}</Text>
                  {pool.fiveHour ? (
                    <QuotaWindowRow
                      title={t("settings.usage.fiveHour")}
                      window={pool.fiveHour}
                      isDark={isDark}
                      t={t}
                    />
                  ) : null}
                  {pool.weekly ? (
                    <QuotaWindowRow
                      title={t("settings.usage.weekly")}
                      window={pool.weekly}
                      isDark={isDark}
                      t={t}
                    />
                  ) : null}
                </View>
              ))}

              {!p.fiveHour && !p.weekly && (!p.extraPools || p.extraPools.length === 0) ? (
                <Text style={[s.noQuotaText, isDark && s.textDim]}>
                  {t("chat.sessionInfo.quota.noLimits")}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  )
}

function QuotaWindowRow({
  title,
  window,
  isDark,
  t,
}: {
  title: string
  window: QuotaWindow
  isDark: boolean
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const isHigh = window.usedPercent > 90
  const isMed = window.usedPercent > 70

  return (
    <View style={s.windowRow}>
      <View style={s.windowHeader}>
        <Text style={[s.windowTitle, isDark && s.textWhite]}>{title}</Text>
        <View style={s.windowValues}>
          <Text
            style={[
              s.windowPercent,
              isHigh ? s.textWarn : isMed ? s.textMid : s.textOk,
            ]}
          >
            {t("settings.usage.used", { percent: window.usedPercent })}
          </Text>
          {window.resetIn ? (
            <Text style={[s.windowReset, isDark && s.textDim]}>
              • {t("settings.usage.resetsIn", { time: window.resetIn })}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Progress bar */}
      <View style={[s.bar, isDark && s.barDark]}>
        <View
          style={[
            s.barFill,
            { width: `${Math.min(window.usedPercent, 100)}%` },
            isHigh ? s.barWarn : isMed ? s.barMid : s.barOk,
          ]}
        />
      </View>

      {/* Remaining & exact timestamp */}
      <View style={s.windowFooter}>
        <Text style={[s.remainingText, isDark && s.textDim]}>
          {t("settings.usage.remaining", { percent: window.remainingPercent })}
        </Text>
        {window.resetsAt ? (
          <Text style={[s.resetTimeText, isDark && s.textDim]}>
            {t("settings.usage.resetTime", {
              time: new Date(window.resetsAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  containerDark: {
    backgroundColor: "#0a0a0a",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  topBarTitle: {
    fontSize: 13,
    color: "#666666",
    flex: 1,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: "#888888",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    overflow: "hidden",
  },
  cardDark: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  cardHeaderDark: {
    borderBottomColor: "#262626",
  },
  providerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  providerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0a0a0a",
  },
  accountBadge: {
    fontSize: 11,
    color: "#8b5cf6",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 160,
  },
  accountBadgeDark: {
    backgroundColor: "#2e1065",
    color: "#c4b5fd",
  },
  cardBody: {
    padding: 16,
    gap: 16,
  },
  windowRow: {
    gap: 6,
  },
  windowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  windowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0a0a0a",
  },
  windowValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  windowPercent: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  windowReset: {
    fontSize: 12,
    color: "#888888",
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e5e5",
    overflow: "hidden",
  },
  barDark: {
    backgroundColor: "#2a2a2a",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  barOk: { backgroundColor: "#10b981" },
  barMid: { backgroundColor: "#f59e0b" },
  barWarn: { backgroundColor: "#ef4444" },
  textOk: { color: "#10b981" },
  textMid: { color: "#f59e0b" },
  textWarn: { color: "#ef4444" },
  windowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  remainingText: {
    fontSize: 11,
    color: "#666666",
  },
  resetTimeText: {
    fontSize: 11,
    color: "#888888",
  },
  extraPoolContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    gap: 12,
  },
  extraPoolTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  noQuotaText: {
    fontSize: 12,
    color: "#888888",
    fontStyle: "italic",
  },
  textWhite: {
    color: "#ffffff",
  },
  textDim: {
    color: "#888888",
  },
})
