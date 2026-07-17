import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const isAdminMock = vi.fn()
const createClientMock = vi.fn()
const createInterfacePageMock = vi.fn()
const updateInterfacePageMock = vi.fn()
const deleteInterfacePageMock = vi.fn()

vi.mock("@/lib/roles", () => ({
  isAdmin: isAdminMock,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}))

vi.mock("@/lib/interface/pages", () => ({
  createInterfacePage: createInterfacePageMock,
  getAllInterfacePages: vi.fn().mockResolvedValue([]),
  getInterfacePage: vi.fn().mockResolvedValue({ id: "p-1", name: "Page" }),
  updateInterfacePage: updateInterfacePageMock,
  deleteInterfacePage: deleteInterfacePageMock,
}))

describe("App-layer auth alignment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("denies non-admin POST /api/interface-groups", async () => {
    isAdminMock.mockResolvedValue(false)
    const { POST } = await import("@/app/api/interface-groups/route")
    const response = await POST(
      new NextRequest("http://localhost/api/interface-groups", {
        method: "POST",
        body: JSON.stringify({ name: "Ops" }),
      })
    )
    expect(response.status).toBe(403)
  })

  it("allows admin POST /api/interface-groups", async () => {
    isAdminMock.mockResolvedValue(true)
    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "interface_groups") {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { order_index: 2 } }),
                })),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { id: "g-1", name: "Ops" }, error: null }),
              })),
            })),
          }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    })
    const { POST } = await import("@/app/api/interface-groups/route")
    const response = await POST(
      new NextRequest("http://localhost/api/interface-groups", {
        method: "POST",
        body: JSON.stringify({ name: "Ops" }),
      })
    )
    expect(response.status).toBe(201)
  })

  it("denies non-admin mutations for interface-group detail and reorder routes", async () => {
    isAdminMock.mockResolvedValue(false)
    const [{ PATCH, DELETE }, { POST: reorderGroups }, { POST: reorderInterfaces }] = await Promise.all([
      import("@/app/api/interface-groups/[groupId]/route"),
      import("@/app/api/interface-groups/reorder/route"),
      import("@/app/api/interfaces/reorder/route"),
    ])

    const patchRes = await PATCH(
      new NextRequest("http://localhost/api/interface-groups/g-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      }),
      { params: Promise.resolve({ groupId: "g-1" }) }
    )
    const deleteRes = await DELETE(
      new NextRequest("http://localhost/api/interface-groups/g-1", { method: "DELETE" }),
      { params: Promise.resolve({ groupId: "g-1" }) }
    )
    const reorderGroupsRes = await reorderGroups(
      new NextRequest("http://localhost/api/interface-groups/reorder", {
        method: "POST",
        body: JSON.stringify({ groupIds: ["g-1", "g-2"] }),
      })
    )
    const reorderInterfacesRes = await reorderInterfaces(
      new NextRequest("http://localhost/api/interfaces/reorder", {
        method: "POST",
        body: JSON.stringify({ interfaceUpdates: [] }),
      })
    )

    expect(patchRes.status).toBe(403)
    expect(deleteRes.status).toBe(403)
    expect(reorderGroupsRes.status).toBe(403)
    expect(reorderInterfacesRes.status).toBe(403)
  })

  it("denies non-admin mutations for interface-pages routes", async () => {
    isAdminMock.mockResolvedValue(false)
    const [{ POST }, { PATCH, DELETE }] = await Promise.all([
      import("@/app/api/interface-pages/route"),
      import("@/app/api/interface-pages/[pageId]/route"),
    ])

    const postRes = await POST(
      new NextRequest("http://localhost/api/interface-pages", {
        method: "POST",
        body: JSON.stringify({ name: "Page", page_type: "content" }),
      })
    )
    const patchRes = await PATCH(
      new NextRequest("http://localhost/api/interface-pages/p-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
      { params: Promise.resolve({ pageId: "p-1" }) }
    )
    const deleteRes = await DELETE(
      new NextRequest("http://localhost/api/interface-pages/p-1", { method: "DELETE" }),
      { params: Promise.resolve({ pageId: "p-1" }) }
    )

    expect(postRes.status).toBe(403)
    expect(patchRes.status).toBe(403)
    expect(deleteRes.status).toBe(403)
  })

  it("allows admin mutations for interface-pages routes", async () => {
    isAdminMock.mockResolvedValue(true)
    createInterfacePageMock.mockResolvedValue({ id: "p-1", name: "Page" })
    updateInterfacePageMock.mockResolvedValue({ id: "p-1", name: "Renamed" })
    deleteInterfacePageMock.mockResolvedValue(undefined)
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } }, error: null }) },
    })

    const [{ POST }, { PATCH, DELETE }] = await Promise.all([
      import("@/app/api/interface-pages/route"),
      import("@/app/api/interface-pages/[pageId]/route"),
    ])

    const postRes = await POST(
      new NextRequest("http://localhost/api/interface-pages", {
        method: "POST",
        body: JSON.stringify({ name: "Page", page_type: "content" }),
      })
    )
    const patchRes = await PATCH(
      new NextRequest("http://localhost/api/interface-pages/p-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
      { params: Promise.resolve({ pageId: "p-1" }) }
    )
    const deleteRes = await DELETE(
      new NextRequest("http://localhost/api/interface-pages/p-1", { method: "DELETE" }),
      { params: Promise.resolve({ pageId: "p-1" }) }
    )

    expect(postRes.status).toBe(200)
    expect(patchRes.status).toBe(200)
    expect(deleteRes.status).toBe(200)
  })

  it("denies non-admin PATCH fallback in /api/pages/[pageId]", async () => {
    isAdminMock.mockResolvedValue(false)
    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "views") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
            })),
          }
        }
        throw new Error(`unexpected table ${table}`)
      }),
    })

    const { PATCH } = await import("@/app/api/pages/[pageId]/route")
    const response = await PATCH(
      new NextRequest("http://localhost/api/pages/p-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Name" }),
      }),
      { params: { pageId: "p-1" } }
    )
    expect(response.status).toBe(403)
  })

  it("maps permission-denied message to 403 in interface-pages PATCH handler", async () => {
    isAdminMock.mockResolvedValue(true)
    updateInterfacePageMock.mockRejectedValue(new Error("permission denied by policy"))
    const { PATCH } = await import("@/app/api/interface-pages/[pageId]/route")
    const response = await PATCH(
      new NextRequest("http://localhost/api/interface-pages/p-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
      { params: Promise.resolve({ pageId: "p-1" }) }
    )
    expect(response.status).toBe(403)
  })

  it("gates sidebar mutation controls behind admin state", () => {
    const sidebarPath = join(process.cwd(), "components", "layout", "AirtableSidebar.tsx")
    const source = readFileSync(sidebarPath, "utf8")
    expect(source).toContain('const showAdminSidebar = isAdmin && !isMemberPreview')
    expect(source).toContain("const isEditMode = isWorkspaceEditing && showAdminSidebar")
    expect(source).toContain("editMode={isEditMode}")
  })
})
