import { describe, expect, it } from "vitest"
import { createDraftRecordStorageId } from "@/lib/records/draft-record-storage-id"

describe("createDraftRecordStorageId", () => {
  it("returns a stable draft-prefixed id", () => {
    const id = createDraftRecordStorageId()
    expect(id.startsWith("draft-")).toBe(true)
    expect(id.length).toBeGreaterThan("draft-".length)
  })
})
