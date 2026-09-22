import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { type Category, defaultPreferences } from "../lib/notifications"
import { clampPageSize, mergeStoredSettings } from "../lib/settings-merge"
import { setAppLocale } from "../lib/i18n/config"
import type { LocalePreference } from "../lib/i18n/locale-resolve"

const SETTINGS_KEY = "opencode_settings"

interface Settings {
  pageSize: number
  notifications: Record<Category, boolean>
  locale: LocalePreference
  enabledModels: string[] | null
}

const DEFAULTS: Settings = {
  pageSize: 25,
  notifications: { ...defaultPreferences },
  locale: "system",
  enabledModels: null,
}

interface SettingsState extends Settings {
  loaded: boolean
  load: () => Promise<void>
  setPageSize: (size: number) => Promise<void>
  setNotification: (category: Category, enabled: boolean) => Promise<void>
  setLocale: (locale: LocalePreference) => Promise<void>
  setEnabledModels: (models: string[] | null) => Promise<void>
  toggleModel: (key: string, allModelKeys: string[]) => Promise<void>
  setProviderModels: (providerKeys: string[], enabled: boolean, allModelKeys: string[]) => Promise<void>
  resetModelFilter: () => Promise<void>
}

function snapshot(get: () => SettingsState): Settings {
  return {
    pageSize: get().pageSize,
    notifications: get().notifications,
    locale: get().locale,
    enabledModels: get().enabledModels,
  }
}

async function persist(settings: Settings) {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings))
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>
      // Merge stored settings with defaults so new fields/categories get their default
      const merged = mergeStoredSettings(DEFAULTS, parsed)
      set({ ...merged, loaded: true })
      setAppLocale(merged.locale)
      return
    }
    set({ loaded: true })
  },

  setPageSize: async (size) => {
    const clamped = clampPageSize(size)
    set({ pageSize: clamped })
    await persist({ ...snapshot(get), pageSize: clamped })
  },

  setNotification: async (category, enabled) => {
    const notifications = { ...get().notifications, [category]: enabled }
    set({ notifications })
    await persist({ ...snapshot(get), notifications })
  },

  setLocale: async (locale) => {
    set({ locale })
    setAppLocale(locale) // applies immediately
    await persist({ ...snapshot(get), locale })
  },

  setEnabledModels: async (models) => {
    set({ enabledModels: models })
    await persist({ ...snapshot(get), enabledModels: models })
  },

  toggleModel: async (key, allModelKeys) => {
    const current = get().enabledModels ?? allModelKeys
    const isCurrentlyEnabled = current.includes(key)
    const next = isCurrentlyEnabled ? current.filter((k) => k !== key) : [...current, key]
    set({ enabledModels: next })
    await persist({ ...snapshot(get), enabledModels: next })
  },

  setProviderModels: async (providerKeys, enabled, allModelKeys) => {
    const current = new Set(get().enabledModels ?? allModelKeys)
    if (enabled) {
      providerKeys.forEach((k) => current.add(k))
    } else {
      providerKeys.forEach((k) => current.delete(k))
    }
    const next = Array.from(current)
    set({ enabledModels: next })
    await persist({ ...snapshot(get), enabledModels: next })
  },

  resetModelFilter: async () => {
    set({ enabledModels: null })
    await persist({ ...snapshot(get), enabledModels: null })
  },
}))
