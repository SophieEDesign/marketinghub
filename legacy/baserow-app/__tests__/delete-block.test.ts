import { beforeEach, describe, expect, it, vi } from "vitest"

const createAdminClientMock = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}))

describe("deleteBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("soft-archives via admin client and throws when no row is updated", async () => {
    const eqMock = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }))
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({ update: updateMock })),
    })

    const { deleteBlock } = await import("@/lib/pages/saveBlocks")

    await expect(deleteBlock("missing-block")).rejects.toThrow(/Block not found/)
    expect(createAdminClientMock).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_archived: true, archived_at: expect.any(String) })
    )
  })

  it("succeeds when admin client archives a row", async () => {
    const eqMock = vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [{ id: "block-1" }], error: null }),
    }))
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({ update: updateMock })),
    })

    const { deleteBlock } = await import("@/lib/pages/saveBlocks")

    await expect(deleteBlock("block-1")).resolves.toBeUndefined()
    expect(eqMock).toHaveBeenCalledWith("id", "block-1")
  })
})
