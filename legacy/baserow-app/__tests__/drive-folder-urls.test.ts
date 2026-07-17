import { describe, it, expect } from "vitest"
import { driveFolderUrl, resolveDriveFolderUrl } from "@/lib/drive/urls"

describe("drive folder urls", () => {
  it("builds a folder url from id", () => {
    expect(driveFolderUrl("abc-123")).toBe("https://drive.google.com/drive/folders/abc-123")
  })

  it("prefers webViewLink when it targets a folder", () => {
    const link = "https://drive.google.com/drive/folders/abc-123?usp=sharing"
    expect(resolveDriveFolderUrl("abc-123", link)).toBe(link)
  })

  it("falls back to folder id when webViewLink is missing", () => {
    expect(resolveDriveFolderUrl("abc-123", null)).toBe(
      "https://drive.google.com/drive/folders/abc-123"
    )
  })
})
