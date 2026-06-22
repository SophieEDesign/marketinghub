import { describe, expect, it } from "vitest"
import type { MockResource } from "@/components/interface/blocks/internal-resource-hub/types"
import {
  attachmentVariantKey,
  getVariants,
  parseAttachmentVariantKey,
  resolveDisplayResource,
} from "@/components/interface/blocks/internal-resource-hub/utils"

const BASE: MockResource = {
  id: "record-1",
  title: "Brand pack",
  category: "documents",
  fileType: "PDF",
  url: "https://example.com/a.pdf",
  attachmentVariants: [
    {
      key: attachmentVariantKey("record-1", 0),
      url: "https://example.com/a.pdf",
      name: "a.pdf",
      fileType: "PDF",
    },
    {
      key: attachmentVariantKey("record-1", 1),
      url: "https://example.com/b.png",
      name: "b.png",
      fileType: "PNG",
    },
  ],
}

describe("resource hub attachment variants", () => {
  it("parses attachment variant keys", () => {
    expect(parseAttachmentVariantKey("record-1::att::1")).toEqual({
      recordId: "record-1",
      index: 1,
    })
    expect(parseAttachmentVariantKey("record-1")).toBeNull()
  })

  it("lists attachment variants for a record", () => {
    const variants = getVariants([BASE], BASE)
    expect(variants).toHaveLength(2)
    expect(variants[1]?.url).toBe("https://example.com/b.png")
    expect(variants[1]?.title).toBe("b.png")
  })

  it("resolves the active attachment for preview and download", () => {
    const variantId = attachmentVariantKey("record-1", 1)
    const active = resolveDisplayResource([BASE], BASE, variantId, 1)
    expect(active?.url).toBe("https://example.com/b.png")
    expect(active?.fileType).toBe("PNG")
  })
})
