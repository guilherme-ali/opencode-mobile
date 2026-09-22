import { test } from "node:test"
import assert from "node:assert/strict"
import { formatResetIn, resolveModelQuota, getDetailedProviderQuotas } from "./quota-format.ts"

test("formatResetIn: formats future timestamps nicely", () => {
  const now = 1_000_000_000_000 // reference timestamp

  // 30 mins
  assert.equal(formatResetIn(now + 30 * 60_000, now), "30m")

  // 2h 15m
  assert.equal(formatResetIn(now + (2 * 3600 + 15 * 60) * 1000, now), "2h 15m")

  // 3 days 4 hours
  assert.equal(formatResetIn(now + (3 * 86400 + 4 * 3600) * 1000, now), "3d 4h")

  // Already passed
  assert.equal(formatResetIn(now - 1000, now), "agora")
})

test("resolveModelQuota: resolves Google/Gemini quota from Antigravity", () => {
  const data = {
    antigravity: {
      accounts: [
        {
          cachedQuota: {
            gemini: {
              windows: [
                { window: "5h", remainingFraction: 0.7, resetTime: "2026-09-22T05:00:00Z" },
                { window: "weekly", remainingFraction: 0.4, resetTime: "2026-09-26T12:00:00Z" },
              ],
            },
          },
        },
      ],
    },
  }

  const result = resolveModelQuota("google", "antigravity-gemini-3.8-flash", data)
  assert.ok(result)
  assert.equal(result?.fiveHour?.usedPercent, 30)
  assert.equal(result?.fiveHour?.remainingPercent, 70)
  assert.equal(result?.weekly?.usedPercent, 60)
  assert.equal(result?.weekly?.remainingPercent, 40)
})

test("resolveModelQuota: resolves Anthropic quota", () => {
  const data = {
    anthropic: {
      main: {
        quota: {
          five_hour: { usedPercent: 25, remainingPercent: 75, resetsAt: "2026-09-22T05:00:00Z" },
          seven_day: { usedPercent: 50, remainingPercent: 50, resetsAt: "2026-09-26T12:00:00Z" },
        },
      },
    },
  }

  const result = resolveModelQuota("anthropic", "claude-sonnet-4-6", data)
  assert.ok(result)
  assert.equal(result?.fiveHour?.usedPercent, 25)
  assert.equal(result?.weekly?.usedPercent, 50)
})

test("getDetailedProviderQuotas: returns formatted list of providers", () => {
  const data = {
    antigravity: {
      accounts: [
        {
          email: "user@gmail.com",
          cachedQuota: {
            gemini: {
              windows: [
                { window: "5h", remainingFraction: 0.8, resetTime: "2026-09-22T05:00:00Z" },
                { window: "weekly", remainingFraction: 0.5, resetTime: "2026-09-26T12:00:00Z" },
              ],
            },
          },
        },
      ],
    },
    openai: {
      main: {
        email: "user@openai.com",
        quota: {
          five_hour: { usedPercent: 10, remainingPercent: 90, resetsAt: "2026-09-22T06:00:00Z" },
        },
      },
    },
  }

  const list = getDetailedProviderQuotas(data)
  assert.equal(list.length, 2)
  assert.equal(list[0].id, "google")
  assert.equal(list[0].fiveHour?.usedPercent, 20)
  assert.equal(list[1].id, "openai")
  assert.equal(list[1].fiveHour?.usedPercent, 10)
})
