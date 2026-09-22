export interface QuotaWindow {
  label: string // "5h" | "weekly"
  usedPercent: number
  remainingPercent: number
  resetsAt?: string
  resetIn?: string
}

export interface ModelQuota {
  provider: string
  model: string
  fiveHour?: QuotaWindow
  weekly?: QuotaWindow
}

export function formatResetIn(resetsAt?: string | number, now = Date.now()): string {
  if (!resetsAt) return ""
  const ts = typeof resetsAt === "number" ? resetsAt : Date.parse(resetsAt)
  if (!Number.isFinite(ts)) return ""

  const diffMs = ts - now
  if (diffMs <= 0) return "agora"

  const diffMins = Math.ceil(diffMs / 60_000)
  if (diffMins < 60) return `${diffMins}m`

  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`
}

export interface RawQuotaData {
  antigravity?: any
  anthropic?: any
  openai?: any
}

export function resolveModelQuota(
  providerID: string,
  modelID: string,
  data: RawQuotaData,
  now = Date.now(),
): ModelQuota | null {
  const p = (providerID || "").toLowerCase()
  const m = (modelID || "").toLowerCase()

  // 1. Antigravity / Google
  if (p === "google" || p.includes("antigravity") || m.includes("gemini")) {
    const acc = data.antigravity?.accounts?.[0]
    const cached = acc?.cachedQuota
    if (cached) {
      const pool = m.includes("gemini") || p === "google" ? cached.gemini : cached["non-gemini"]
      if (pool?.windows) {
        let fiveHour: QuotaWindow | undefined
        let weekly: QuotaWindow | undefined

        for (const w of pool.windows) {
          const remainingFrac = typeof w.remainingFraction === "number" ? w.remainingFraction : 1
          const remPct = Math.round(Math.max(0, Math.min(1, remainingFrac)) * 100)
          const usedPct = 100 - remPct

          if (w.window === "5h") {
            fiveHour = {
              label: "5h",
              usedPercent: usedPct,
              remainingPercent: remPct,
              resetsAt: w.resetTime,
              resetIn: formatResetIn(w.resetTime, now),
            }
          } else if (w.window === "weekly" || w.window === "7d") {
            weekly = {
              label: "weekly",
              usedPercent: usedPct,
              remainingPercent: remPct,
              resetsAt: w.resetTime,
              resetIn: formatResetIn(w.resetTime, now),
            }
          }
        }

        if (fiveHour || weekly) {
          return { provider: providerID, model: modelID, fiveHour, weekly }
        }
      }
    }
  }

  // 2. Anthropic / Claude
  if (p === "anthropic" || m.includes("claude")) {
    const q = data.anthropic?.main?.quota
    if (q) {
      let fiveHour: QuotaWindow | undefined
      let weekly: QuotaWindow | undefined

      if (q.five_hour) {
        const used = typeof q.five_hour.usedPercent === "number" ? q.five_hour.usedPercent : 100 - (q.five_hour.remainingPercent ?? 100)
        fiveHour = {
          label: "5h",
          usedPercent: used,
          remainingPercent: 100 - used,
          resetsAt: q.five_hour.resetsAt,
          resetIn: formatResetIn(q.five_hour.resetsAt, now),
        }
      }
      if (q.seven_day) {
        const used = typeof q.seven_day.usedPercent === "number" ? q.seven_day.usedPercent : 100 - (q.seven_day.remainingPercent ?? 100)
        weekly = {
          label: "weekly",
          usedPercent: used,
          remainingPercent: 100 - used,
          resetsAt: q.seven_day.resetsAt,
          resetIn: formatResetIn(q.seven_day.resetsAt, now),
        }
      }

      if (fiveHour || weekly) {
        return { provider: providerID, model: modelID, fiveHour, weekly }
      }
    }

    // Check if Antigravity has non-gemini pool as fallback for Claude
    const acc = data.antigravity?.accounts?.[0]
    const nonGemini = acc?.cachedQuota?.["non-gemini"]
    if (nonGemini?.windows) {
      let fiveHour: QuotaWindow | undefined
      let weekly: QuotaWindow | undefined
      for (const w of nonGemini.windows) {
        const remPct = Math.round((w.remainingFraction ?? 1) * 100)
        const usedPct = 100 - remPct
        if (w.window === "5h") {
          fiveHour = { label: "5h", usedPercent: usedPct, remainingPercent: remPct, resetsAt: w.resetTime, resetIn: formatResetIn(w.resetTime, now) }
        } else if (w.window === "weekly" || w.window === "7d") {
          weekly = { label: "weekly", usedPercent: usedPct, remainingPercent: remPct, resetsAt: w.resetTime, resetIn: formatResetIn(w.resetTime, now) }
        }
      }
      if (fiveHour || weekly) return { provider: providerID, model: modelID, fiveHour, weekly }
    }
  }

  // 3. OpenAI / GPT
  if (p === "openai" || m.includes("gpt")) {
    const q = data.openai?.main?.quota || data.openai?.quota
    if (q) {
      let fiveHour: QuotaWindow | undefined
      let weekly: QuotaWindow | undefined

      // Support sidebar-state.json (primary = 5h / 300m, secondary = weekly / 10080m)
      const primary = q.primary || q.five_hour
      const secondary = q.secondary || q.seven_day || q.weekly

      if (primary && typeof primary.usedPercent === "number") {
        const used = primary.usedPercent
        fiveHour = {
          label: "5h",
          usedPercent: used,
          remainingPercent: primary.remainingPercent ?? (100 - used),
          resetsAt: primary.resetsAt,
          resetIn: formatResetIn(primary.resetsAt, now),
        }
      }

      if (secondary && typeof secondary.usedPercent === "number") {
        const used = secondary.usedPercent
        weekly = {
          label: "weekly",
          usedPercent: used,
          remainingPercent: secondary.remainingPercent ?? (100 - used),
          resetsAt: secondary.resetsAt,
          resetIn: formatResetIn(secondary.resetsAt, now),
        }
      }

      if (fiveHour || weekly) return { provider: providerID, model: modelID, fiveHour, weekly }
    }
  }

  return null
}

export interface ProviderQuotaDetail {
  id: string
  name: string
  accountLabel?: string
  fiveHour?: QuotaWindow
  weekly?: QuotaWindow
  extraPools?: Array<{
    name: string
    fiveHour?: QuotaWindow
    weekly?: QuotaWindow
  }>
}

export function getDetailedProviderQuotas(data: RawQuotaData, now = Date.now()): ProviderQuotaDetail[] {
  const result: ProviderQuotaDetail[] = []

  // 1. Google / Gemini
  const antiAcc = data.antigravity?.accounts?.[0]
  const antiCached = antiAcc?.cachedQuota
  if (antiCached) {
    const geminiPool = antiCached.gemini
    let gemini5h: QuotaWindow | undefined
    let geminiWeekly: QuotaWindow | undefined

    if (geminiPool?.windows) {
      for (const w of geminiPool.windows) {
        const remFrac = typeof w.remainingFraction === "number" ? w.remainingFraction : 1
        const remPct = Math.round(Math.max(0, Math.min(1, remFrac)) * 100)
        const usedPct = 100 - remPct
        if (w.window === "5h") {
          gemini5h = {
            label: "5h",
            usedPercent: usedPct,
            remainingPercent: remPct,
            resetsAt: w.resetTime,
            resetIn: formatResetIn(w.resetTime, now),
          }
        } else if (w.window === "weekly" || w.window === "7d") {
          geminiWeekly = {
            label: "weekly",
            usedPercent: usedPct,
            remainingPercent: remPct,
            resetsAt: w.resetTime,
            resetIn: formatResetIn(w.resetTime, now),
          }
        }
      }
    }

    const extraPools: ProviderQuotaDetail["extraPools"] = []
    const nonGemini = antiCached["non-gemini"]
    if (nonGemini?.windows) {
      let ng5h: QuotaWindow | undefined
      let ngWeekly: QuotaWindow | undefined
      for (const w of nonGemini.windows) {
        const remFrac = typeof w.remainingFraction === "number" ? w.remainingFraction : 1
        const remPct = Math.round(Math.max(0, Math.min(1, remFrac)) * 100)
        const usedPct = 100 - remPct
        if (w.window === "5h") {
          ng5h = {
            label: "5h",
            usedPercent: usedPct,
            remainingPercent: remPct,
            resetsAt: w.resetTime,
            resetIn: formatResetIn(w.resetTime, now),
          }
        } else if (w.window === "weekly" || w.window === "7d") {
          ngWeekly = {
            label: "weekly",
            usedPercent: usedPct,
            remainingPercent: remPct,
            resetsAt: w.resetTime,
            resetIn: formatResetIn(w.resetTime, now),
          }
        }
      }
      extraPools.push({ name: "Claude (Antigravity)", fiveHour: ng5h, weekly: ngWeekly })
    }

    result.push({
      id: "google",
      name: "Google (Gemini)",
      accountLabel: antiAcc.email || antiAcc.label || undefined,
      fiveHour: gemini5h,
      weekly: geminiWeekly,
      extraPools,
    })
  }

  // 2. OpenAI / GPT
  const openAiQ = data.openai?.main?.quota || data.openai?.quota
  if (openAiQ) {
    let fiveHour: QuotaWindow | undefined
    let weekly: QuotaWindow | undefined

    const primary = openAiQ.primary || openAiQ.five_hour
    const secondary = openAiQ.secondary || openAiQ.seven_day || openAiQ.weekly

    if (primary && typeof primary.usedPercent === "number") {
      const used = primary.usedPercent
      fiveHour = {
        label: "5h",
        usedPercent: used,
        remainingPercent: primary.remainingPercent ?? (100 - used),
        resetsAt: primary.resetsAt,
        resetIn: formatResetIn(primary.resetsAt, now),
      }
    }

    if (secondary && typeof secondary.usedPercent === "number") {
      const used = secondary.usedPercent
      weekly = {
        label: "weekly",
        usedPercent: used,
        remainingPercent: secondary.remainingPercent ?? (100 - used),
        resetsAt: secondary.resetsAt,
        resetIn: formatResetIn(secondary.resetsAt, now),
      }
    }

    if (fiveHour || weekly) {
      result.push({
        id: "openai",
        name: "OpenAI (ChatGPT / Codex)",
        accountLabel:
          data.openai?.main?.email ||
          data.openai?.main?.label ||
          data.openai?.main?.mainAccountId ||
          undefined,
        fiveHour,
        weekly,
      })
    }
  }

  // 3. Anthropic / Claude
  const antQ = data.anthropic?.main?.quota
  if (antQ && (antQ.five_hour || antQ.seven_day)) {
    let fiveHour: QuotaWindow | undefined
    let weekly: QuotaWindow | undefined
    if (antQ.five_hour && typeof antQ.five_hour.usedPercent === "number") {
      const used = antQ.five_hour.usedPercent
      fiveHour = {
        label: "5h",
        usedPercent: used,
        remainingPercent: antQ.five_hour.remainingPercent ?? (100 - used),
        resetsAt: antQ.five_hour.resetsAt,
        resetIn: formatResetIn(antQ.five_hour.resetsAt, now),
      }
    }
    if (antQ.seven_day && typeof antQ.seven_day.usedPercent === "number") {
      const used = antQ.seven_day.usedPercent
      weekly = {
        label: "weekly",
        usedPercent: used,
        remainingPercent: antQ.seven_day.remainingPercent ?? (100 - used),
        resetsAt: antQ.seven_day.resetsAt,
        resetIn: formatResetIn(antQ.seven_day.resetsAt, now),
      }
    }

    if (fiveHour || weekly) {
      result.push({
        id: "anthropic",
        name: "Anthropic (Claude)",
        accountLabel: data.anthropic?.main?.email || data.anthropic?.main?.label || undefined,
        fiveHour,
        weekly,
      })
    }
  }

  return result
}
