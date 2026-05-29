import { describe, expect, it } from "vitest"
import { isChunkLoadError } from "@/lib/chunk-load-error"

describe("isChunkLoadError", () => {
  it("detects ChunkLoadError by name", () => {
    expect(isChunkLoadError(new Error("Loading chunk 223 failed."))).toBe(true)
  })

  it("detects dynamic import failures", () => {
    expect(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module"))
    ).toBe(true)
  })

  it("returns false for unrelated errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false)
  })
})
