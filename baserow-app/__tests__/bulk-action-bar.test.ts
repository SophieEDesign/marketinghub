import { describe, expect, it } from "vitest"
import { BULK_ACTION_MIN_SELECTED_COUNT } from "@/components/grid/BulkActionBar"

describe("BulkActionBar REG-001", () => {
  it("requires at least two checkbox-selected rows before showing bulk UI", () => {
    expect(BULK_ACTION_MIN_SELECTED_COUNT).toBe(2)
  })

  it("does not show bulk UI threshold for a single selection", () => {
    const selectedCount = 1
    expect(selectedCount < BULK_ACTION_MIN_SELECTED_COUNT).toBe(true)
  })

  it("shows bulk UI threshold for two or more selections", () => {
    expect(2 < BULK_ACTION_MIN_SELECTED_COUNT).toBe(false)
    expect(3 < BULK_ACTION_MIN_SELECTED_COUNT).toBe(false)
  })
})
