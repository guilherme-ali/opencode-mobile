import { useMemo, useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  useColorScheme,
} from "react-native"
import { Stack } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useCatalog } from "../../src/stores/catalog"
import { useSettings } from "../../src/stores/settings"

export default function ModelsSettingsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const providers = useCatalog((s) => s.providers)
  const { enabledModels, toggleModel, setProviderModels, resetModelFilter, setEnabledModels } = useSettings()

  const [search, setSearch] = useState("")

  // All model keys across all providers
  const allModelKeys = useMemo(() => {
    const keys: string[] = []
    for (const p of providers) {
      for (const m of p.models || []) {
        keys.push(`${p.id}/${m.id}`)
      }
    }
    return keys
  }, [providers])

  // Filtered providers and models based on search query
  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return providers

    return providers
      .map((p) => {
        const matchesProvider = p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
        const filteredModels = (p.models || []).filter(
          (m) =>
            matchesProvider ||
            m.name.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q),
        )
        return { ...p, models: filteredModels }
      })
      .filter((p) => p.models.length > 0)
  }, [providers, search])

  const isModelActive = (key: string) => {
    if (enabledModels === null) return true
    return enabledModels.includes(key)
  }

  const handleSelectAll = () => {
    setEnabledModels(allModelKeys)
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t("settings.models.label"),
          headerBackTitle: t("common.back", "Back"),
        }}
      />
      <ScrollView
        style={[s.container, isDark && s.containerDark]}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search bar */}
        <View style={s.searchContainer}>
          <View style={[s.searchBox, isDark && s.searchBoxDark]}>
            <Ionicons name="search" size={18} color={isDark ? "#888888" : "#999999"} />
            <TextInput
              style={[s.searchInput, isDark && s.textWhite]}
              placeholder={t("settings.models.searchPlaceholder")}
              placeholderTextColor={isDark ? "#666666" : "#999999"}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={isDark ? "#888888" : "#999999"} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Global Action Bar */}
        <View style={s.actionsBar}>
          <TouchableOpacity
            style={[s.actionButton, isDark && s.actionButtonDark]}
            onPress={handleSelectAll}
          >
            <Ionicons name="checkmark-done-outline" size={16} color="#8b5cf6" />
            <Text style={s.actionButtonText}>{t("settings.models.selectAll")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionButton, isDark && s.actionButtonDark]}
            onPress={resetModelFilter}
          >
            <Ionicons name="refresh-outline" size={16} color={isDark ? "#aaaaaa" : "#666666"} />
            <Text style={[s.actionButtonText, isDark && s.textDim]}>
              {t("settings.models.resetDefault")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notice if no providers connected */}
        {providers.length === 0 && (
          <View style={s.emptyBox}>
            <Ionicons name="cloud-offline-outline" size={40} color={isDark ? "#444444" : "#cccccc"} />
            <Text style={[s.emptyText, isDark && s.textDim]}>
              {t("settings.models.noConnectedNotice")}
            </Text>
          </View>
        )}

        {/* Notice if search yields no models */}
        {providers.length > 0 && filteredProviders.length === 0 && (
          <View style={s.emptyBox}>
            <Ionicons name="search-outline" size={40} color={isDark ? "#444444" : "#cccccc"} />
            <Text style={[s.emptyText, isDark && s.textDim]}>
              {t("settings.models.emptyNotice")}
            </Text>
          </View>
        )}

        {/* Providers and Models */}
        {filteredProviders.map((provider) => {
          const providerModels = provider.models || []
          const providerModelKeys = providerModels.map((m) => `${provider.id}/${m.id}`)
          const activeCount = providerModelKeys.filter((k) => isModelActive(k)).length
          const allActive = activeCount === providerModelKeys.length

          return (
            <View key={provider.id} style={s.section}>
              {/* Provider Header */}
              <View style={[s.providerHeader, isDark && s.providerHeaderDark]}>
                <View style={s.providerInfo}>
                  <Text style={[s.providerName, isDark && s.textWhite]}>
                    {provider.name || provider.id}
                  </Text>
                  <Text style={[s.providerCount, isDark && s.textDim]}>
                    {t("settings.models.activeCount", {
                      active: activeCount,
                      total: providerModelKeys.length,
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.toggleAllBtn, isDark && s.toggleAllBtnDark]}
                  onPress={() => setProviderModels(providerModelKeys, !allActive, allModelKeys)}
                >
                  <Text style={s.toggleAllBtnText}>
                    {allActive ? "Desmarcar todos" : "Marcar todos"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Models List */}
              <View style={[s.modelsCard, isDark && s.modelsCardDark]}>
                {providerModels.map((model, idx) => {
                  const key = `${provider.id}/${model.id}`
                  const active = isModelActive(key)
                  const isLast = idx === providerModels.length - 1

                  return (
                    <View
                      key={model.id}
                      style={[
                        s.modelRow,
                        isDark && s.modelRowDark,
                        isLast && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={s.modelInfo}>
                        <View style={s.modelTitleRow}>
                          <Text style={[s.modelName, isDark && s.textWhite]} numberOfLines={1}>
                            {model.name || model.id}
                          </Text>
                          {model.reasoning && (
                            <View style={[s.badge, s.badgeReasoning]}>
                              <Text style={s.badgeText}>raciocínio</Text>
                            </View>
                          )}
                          {model.attachment && (
                            <View style={[s.badge, s.badgeAttachment]}>
                              <Ionicons name="image-outline" size={11} color="#0284c7" />
                            </View>
                          )}
                        </View>
                        <Text style={[s.modelId, isDark && s.textDim]} numberOfLines={1}>
                          {model.id}
                        </Text>
                      </View>

                      <Switch
                        value={active}
                        onValueChange={() => toggleModel(key, allModelKeys)}
                        trackColor={{ false: "#767577", true: "#8b5cf6" }}
                      />
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </>
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
    paddingBottom: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  searchBoxDark: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0a0a0a",
    padding: 0,
  },
  actionsBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  actionButtonDark: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8b5cf6",
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  providerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  providerHeaderDark: {},
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0a0a",
  },
  providerCount: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  toggleAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#ede9fe",
  },
  toggleAllBtnDark: {
    backgroundColor: "#2e1065",
  },
  toggleAllBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7c3aed",
  },
  modelsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    overflow: "hidden",
  },
  modelsCardDark: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  modelRowDark: {
    borderBottomColor: "#2a2a2a",
  },
  modelInfo: {
    flex: 1,
    marginRight: 12,
  },
  modelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modelName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#0a0a0a",
    flexShrink: 1,
  },
  modelId: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeReasoning: {
    backgroundColor: "#f5f3ff",
  },
  badgeAttachment: {
    backgroundColor: "#e0f2fe",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#7c3aed",
    textTransform: "uppercase",
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
  textWhite: {
    color: "#ffffff",
  },
  textDim: {
    color: "#888888",
  },
})
