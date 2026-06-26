import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const isAdminMock = vi.fn()
const createClientMock = vi.fn()
const saveBlockLayoutMock = vi.fn()
const createBlockMock = vi.fn()
const deleteBlockMock = vi.fn()
const executeAutomationMock = vi.fn()
const runRecordAutomationsMock = vi.fn()
const restoreVersionMock = vi.fn()

vi.mock("@/lib/roles", () => ({
  isAdmin: isAdminMock,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}))

vi.mock("@/lib/pages/saveBlocks", () => ({
  saveBlockLayout: saveBlockLayoutMock,
  createBlock: createBlockMock,
  deleteBlock: deleteBlockMock,
}))

vi.mock("@/lib/automations/engine", () => ({
  executeAutomation: executeAutomationMock,
}))

vi.mock("@/lib/automations/record-trigger", () => ({
  runRecordAutomations: runRecordAutomationsMock,
  getTableIdFromSupabaseTable: vi.fn(),
}))

vi.mock("@/lib/versioning/versioning", () => ({
  restoreVersion: restoreVersionMock,
}))

describe("P0 authz gates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveBlockLayoutMock.mockResolvedValue(undefined)
    createBlockMock.mockResolvedValue({ id: "block-1", type: "text" })
    deleteBlockMock.mockResolvedValue(undefined)
    executeAutomationMock.mockResolvedValue({ success: true, runId: "run-1", logs: [] })
    runRecordAutomationsMock.mockResolvedValue({ executed: 0, errors: [] })
    restoreVersionMock.mockResolvedValue({ version_number: 1 })
  })

  it("denies non-admin PATCH /api/pages/[pageId]/blocks", async () => {
    isAdminMock.mockResolvedValue(false)
    const { PATCH } = await import("@/app/api/pages/[pageId]/blocks/route")
    const response = await PATCH(
      new NextRequest("http://localhost/api/pages/p-1/blocks", {
        method: "PATCH",
        body: JSON.stringify({ layout: [{ i: "b-1", x: 0, y: 0, w: 4, h: 4 }] }),
      }),
      { params: Promise.resolve({ pageId: "p-1" }) }
    )
    expect(response.status).toBe(403)
    expect(saveBlockLayoutMock).not.toHaveBeenCalled()
  })

  it("allows admin PATCH /api/pages/[pageId]/blocks layout save", async () => {
    isAdminMock.mockResolvedValue(true)
    const { PATCH } = await import("@/app/api/pages/[pageId]/blocks/route")
    const response = await PATCH(
      new NextRequest("http://localhost/api/pages/p-1/blocks", {
        method: "PATCH",
        body: JSON.stringify({ layout: [{ i: "b-1", x: 0, y: 0, w: 4, h: 4 }] }),
      }),
      { params: Promise.resolve({ pageId: "p-1" }) }
    )
    expect(response.status).toBe(200)
    expect(saveBlockLayoutMock).toHaveBeenCalledWith("p-1", [{ i: "b-1", x: 0, y: 0, w: 4, h: 4 }])
  })

  it("denies non-admin DELETE /api/pages/[pageId]/blocks/[blockId]", async () => {
    isAdminMock.mockResolvedValue(false)
    const { DELETE } = await import("@/app/api/pages/[pageId]/blocks/[blockId]/route")
    const response = await DELETE(
      new NextRequest("http://localhost/api/pages/p-1/blocks/b-1", { method: "DELETE" }),
      { params: Promise.resolve({ pageId: "p-1", blockId: "b-1" }) }
    )
    expect(response.status).toBe(403)
    expect(deleteBlockMock).not.toHaveBeenCalled()
  })

  it("denies non-admin POST automation test", async () => {
    isAdminMock.mockResolvedValue(false)
    const { POST } = await import("@/app/api/automations/[automationId]/test/route")
    const response = await POST(
      new NextRequest("http://localhost/api/automations/a-1/test", { method: "POST" }),
      { params: { automationId: "a-1" } }
    )
    expect(response.status).toBe(403)
    expect(executeAutomationMock).not.toHaveBeenCalled()
  })

  it("denies non-admin POST /api/automations/trigger-record", async () => {
    isAdminMock.mockResolvedValue(false)
    const { POST } = await import("@/app/api/automations/trigger-record/route")
    const response = await POST(
      new NextRequest("http://localhost/api/automations/trigger-record", {
        method: "POST",
        body: JSON.stringify({
          tableId: "t-1",
          triggerType: "row_created",
          record: { id: "r-1" },
        }),
      })
    )
    expect(response.status).toBe(403)
    expect(runRecordAutomationsMock).not.toHaveBeenCalled()
  })

  it("denies non-admin POST /api/versioning/versions/restore", async () => {
    isAdminMock.mockResolvedValue(false)
    const { POST } = await import("@/app/api/versioning/versions/restore/route")
    const response = await POST(
      new NextRequest("http://localhost/api/versioning/versions/restore", {
        method: "POST",
        body: JSON.stringify({
          entity_type: "page",
          entity_id: "p-1",
          version_number: 1,
        }),
      })
    )
    expect(response.status).toBe(403)
    expect(restoreVersionMock).not.toHaveBeenCalled()
  })

  it("denies non-admin GET /api/admin/pdf/templates", async () => {
    isAdminMock.mockResolvedValue(false)
    const { GET } = await import("@/app/api/admin/pdf/templates/route")
    const response = await GET(new NextRequest("http://localhost/api/admin/pdf/templates"))
    expect(response.status).toBe(403)
  })

  it("middleware uses getUser instead of getSession", () => {
    const source = readFileSync(join(process.cwd(), "middleware.ts"), "utf8")
    expect(source).toContain("supabase.auth.getUser()")
    expect(source).not.toContain("getSession()")
  })

  it("run_script action is disabled (no eval execution)", async () => {
    const source = readFileSync(
      join(process.cwd(), "lib/automations/actions.ts"),
      "utf8"
    )
    expect(source).not.toMatch(/\bconst result = eval\(/)
    expect(source).toContain("run_script is disabled for security")

    const { executeAction } = await import("@/lib/automations/actions")
    const result = await executeAction(
      { type: "run_script", script: "return 1" } as any,
      { trigger_data: {} } as any
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain("run_script is disabled")
  })

  it("InternalResourceHubBlock overlay uses md:left-sidebar", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/interface/blocks/InternalResourceHubBlock.tsx"
      ),
      "utf8"
    )
    expect(source).toContain("md:left-sidebar")
    expect(source).not.toContain("md:left-64")
  })
})
