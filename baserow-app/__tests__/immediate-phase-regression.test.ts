import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const isAdminMock = vi.fn()
const createClientMock = vi.fn()
const createAdminClientMock = vi.fn()
const getTablesMock = vi.fn()
const getTableFieldsMock = vi.fn()
const getRedirectUrlMock = vi.fn()

vi.mock("@/lib/roles", () => ({
  isAdmin: isAdminMock,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock("@/lib/crud/tables", () => ({
  getTables: getTablesMock,
}))

vi.mock("@/lib/fields/schema", () => ({
  getTableFields: getTableFieldsMock,
}))

vi.mock("@/lib/auth-utils", () => ({
  authErrorToMessage: () => "Auth error",
  getRedirectUrl: getRedirectUrlMock,
}))

describe("Immediate Phase Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRedirectUrlMock.mockResolvedValue("/")
    getTablesMock.mockResolvedValue([])
    getTableFieldsMock.mockResolvedValue([])
  })

  it("denies non-admin full database export", async () => {
    isAdminMock.mockResolvedValue(false)
    const { GET } = await import("@/app/api/export/full-database/route")

    const response = await GET()
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized: Admin access required",
    })
  })

  it("reinvite fallback does not expose recoveryLink", async () => {
    isAdminMock.mockResolvedValue(true)

    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { role: "member" } }),
          })),
        })),
      })),
    })

    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "u-1",
                email: "user@example.com",
                encrypted_password: "",
                user_metadata: {},
              },
            },
            error: null,
          }),
          generateLink: vi.fn().mockResolvedValue({
            data: { properties: { action_link: "https://secret-link.example" } },
            error: null,
          }),
        },
      },
    })

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "delivery failed" }),
      })
    )

    const { POST } = await import("@/app/api/users/[userId]/reinvite/route")
    const response = await POST(
      new NextRequest("http://localhost/api/users/u-1/reinvite", { method: "POST" }),
      { params: Promise.resolve({ userId: "u-1" }) }
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.success).toBe(true)
    expect(payload.recoveryLink).toBeUndefined()
    expect(payload.message).toContain("Password reset flow initiated")
  })

  it("auth callback creates missing profile with member role default", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))

    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "u-2",
              created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: selectMock,
            insert: insertMock,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const { GET } = await import("@/app/auth/callback/route")
    const response = await GET(new NextRequest("http://localhost/auth/callback?code=test"))

    expect(response.status).toBe(307)
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u-2",
      role: "member",
    })
  })

  it("stale table resolution guard blocks cancelled or outdated async results", async () => {
    const { shouldApplyResolvedTableId } = await import("@/lib/immediate-phase/guards")

    expect(shouldApplyResolvedTableId(false, 2, 2)).toBe(true)
    expect(shouldApplyResolvedTableId(true, 2, 2)).toBe(false)
    expect(shouldApplyResolvedTableId(false, 1, 2)).toBe(false)
  })

  it("mapInStableOrder preserves input ordering with async delays", async () => {
    const { mapInStableOrder } = await import("@/lib/immediate-phase/guards")

    const items = ["first", "second", "third"]
    const result = await mapInStableOrder(items, async (item) => {
      if (item === "first") {
        await new Promise((resolve) => setTimeout(resolve, 30))
      }
      if (item === "second") {
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
      return `${item}-done`
    })

    expect(result).toEqual(["first-done", "second-done", "third-done"])
  })

  it("attachScrollSyncListener adds and removes exactly one scroll listener", async () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const bodyEl = {
      addEventListener,
      removeEventListener,
    } as unknown as HTMLElement
    const handler = vi.fn()

    const { attachScrollSyncListener } = await import("@/lib/immediate-phase/guards")
    const cleanup = attachScrollSyncListener(bodyEl, handler)

    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(addEventListener).toHaveBeenCalledWith("scroll", handler, { passive: true })

    cleanup()

    expect(removeEventListener).toHaveBeenCalledTimes(1)
    expect(removeEventListener).toHaveBeenCalledWith("scroll", handler)
  })
})
