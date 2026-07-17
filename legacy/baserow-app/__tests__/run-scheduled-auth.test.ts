/**
 * Cron route auth: production must require CRON_SECRET + matching Bearer token.
 */

import { describe, it, expect, vi, afterEach } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("GET /api/automations/run-scheduled", () => {
  it("returns 503 in production when CRON_SECRET is unset", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CRON_SECRET", "")
    const { GET } = await import("@/app/api/automations/run-scheduled/route")
    const res = await GET(new Request("http://localhost/api/automations/run-scheduled"))
    expect(res.status).toBe(503)
  })

  it("returns 401 in production when CRON_SECRET is set but Authorization is wrong", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CRON_SECRET", "expected-secret")
    const { GET } = await import("@/app/api/automations/run-scheduled/route")
    const res = await GET(
      new Request("http://localhost/api/automations/run-scheduled", {
        headers: { authorization: "Bearer wrong" },
      })
    )
    expect(res.status).toBe(401)
  })
})
