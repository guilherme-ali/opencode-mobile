import { create } from "zustand"
import { useConnections } from "./connections"
import { resolveModelQuota, type ModelQuota, type RawQuotaData } from "../lib/quota-format"

interface QuotaState {
  raw: RawQuotaData
  loading: boolean
  lastFetched: number
  load: () => Promise<void>
  getQuotaForModel: (providerID: string, modelID: string) => ModelQuota | null
}

export const useQuota = create<QuotaState>((set, get) => ({
  raw: {},
  loading: false,
  lastFetched: 0,

  load: async () => {
    const connState = useConnections.getState()
    const client = connState.client
    if (!client) return

    set({ loading: true })
    try {
      // 1. Query server paths to locate config and home directories
      const paths = await client.path.get().catch(() => null)
      const configDir = paths?.config
      const homeDir = paths?.home
      if (!configDir) {
        set({ loading: false })
        return
      }

      // 2. Query auth state files
      const configClient = connState.clientForDirectory(configDir) ?? client

      // Check both Windows Temp and POSIX /tmp for active runtime sidebar states
      const isWin = homeDir && homeDir.includes("\\")
      const winTemp = homeDir ? `${homeDir}\\AppData\\Local\\Temp` : ""
      const openaiTempDir = isWin ? `${winTemp}\\opencode-openai-auth` : "/tmp/opencode-openai-auth"
      const anthropicTempDir = isWin ? `${winTemp}\\opencode-anthropic-auth` : "/tmp/opencode-anthropic-auth"

      const openaiTempClient = connState.clientForDirectory(openaiTempDir) ?? client
      const anthropicTempClient = connState.clientForDirectory(anthropicTempDir) ?? client

      const [
        antigravityRes,
        openaiSidebarRes,
        anthropicSidebarRes,
        openaiStateRes,
        anthropicStateRes,
      ] = await Promise.all([
        configClient.file.content("antigravity-accounts.json").catch(() => null),
        openaiTempClient.file.content("sidebar-state.json").catch(() => null),
        anthropicTempClient.file.content("sidebar-state.json").catch(() => null),
        configClient.file.content("openai-auth-state.json").catch(() => null),
        configClient.file.content("anthropic-auth-state.json").catch(() => null),
      ])

      const raw: RawQuotaData = {}
      if (antigravityRes?.content) {
        try {
          raw.antigravity = JSON.parse(antigravityRes.content)
        } catch {}
      }

      // Prefer live runtime sidebar state for OpenAI, fallback to config
      if (openaiSidebarRes?.content) {
        try {
          raw.openai = JSON.parse(openaiSidebarRes.content)
        } catch {}
      } else if (openaiStateRes?.content) {
        try {
          raw.openai = JSON.parse(openaiStateRes.content)
        } catch {}
      }

      // Prefer live runtime sidebar state for Anthropic
      if (anthropicSidebarRes?.content) {
        try {
          raw.anthropic = JSON.parse(anthropicSidebarRes.content)
        } catch {}
      } else if (anthropicStateRes?.content) {
        try {
          raw.anthropic = JSON.parse(anthropicStateRes.content)
        } catch {}
      }

      set({ raw, loading: false, lastFetched: Date.now() })
    } catch {
      set({ loading: false })
    }
  },

  getQuotaForModel: (providerID: string, modelID: string) => {
    return resolveModelQuota(providerID, modelID, get().raw)
  },
}))
