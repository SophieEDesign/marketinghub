import { describe, it, expect } from "vitest"
import {
  buildResourceHubItems,
  extractGoogleDriveFileId,
  parseHubCategory,
  resolveResourceCategory,
  resolveResourceSource,
  resolveResourceThumbnailUrl,
} from "@/lib/marketing/resource-hub-data"
import type { MediaFieldMap } from "@/lib/marketing/resource-hub-data"

const FIELDS: MediaFieldMap = {
  name: "name",
  notes: "notes",
  hubCategory: "hub_category",
  status: "status",
  documentLink: "document_link",
  attachments: "attachments",
  assignee: null,
  updatedAt: null,
}

describe("parseHubCategory", () => {
  it("accepts canonical category ids", () => {
    expect(parseHubCategory("logos")).toBe("logos")
    expect(parseHubCategory("brand-guidelines")).toBe("brand-guidelines")
    expect(parseHubCategory("presentations")).toBe("presentations")
  })

  it("accepts sidebar labels", () => {
    expect(parseHubCategory("Logos")).toBe("logos")
    expect(parseHubCategory("Brand Guidelines")).toBe("brand-guidelines")
    expect(parseHubCategory("Presentations")).toBe("presentations")
  })

  it("returns null for empty or unknown values", () => {
    expect(parseHubCategory(null)).toBeNull()
    expect(parseHubCategory("")).toBeNull()
    expect(parseHubCategory("random")).toBeNull()
  })
})

describe("resolveResourceCategory", () => {
  it("prefers hub_category over legacy status and file type", () => {
    expect(resolveResourceCategory("Images", "logo pack", "PPTX")).toBe("images")
  })

  it("falls back to legacy status heuristics", () => {
    expect(resolveResourceCategory(null, "Brand guideline PDF", "PDF")).toBe("brand-guidelines")
  })

  it("falls back to file extension when hub_category and status are empty", () => {
    expect(resolveResourceCategory(null, null, "PPTX")).toBe("presentations")
    expect(resolveResourceCategory(null, null, "PNG")).toBe("images")
    expect(resolveResourceCategory(null, null, "PDF")).toBe("documents")
  })
})

describe("buildResourceHubItems", () => {
  it("uses hub_category for sidebar grouping", () => {
    const items = buildResourceHubItems(
      [
        {
          id: "1",
          name: "Deck",
          hub_category: "Presentations",
          document_link: "https://example.com/file.pdf",
        },
        {
          id: "2",
          name: "Logo",
          hub_category: "Logos",
          document_link: "https://example.com/logo.png",
        },
      ],
      FIELDS,
      "media-table"
    )
    expect(items).toHaveLength(2)
    expect(items[0].category).toBe("presentations")
    expect(items[1].category).toBe("logos")
  })

  it("maps extensionless presentation links to presentation type", () => {
    const items = buildResourceHubItems(
      [
        {
          id: "3",
          name: "Quarterly deck",
          hub_category: null,
          status: null,
          document_link: "https://present.petersandmay.com/general",
        },
      ],
      FIELDS,
      "media-table"
    )

    expect(items).toHaveLength(1)
    expect(items[0].fileType).toBe("PPTX")
    expect(items[0].category).toBe("presentations")
  })

  it("maps extensionless non-presentation links to generic link type", () => {
    const items = buildResourceHubItems(
      [
        {
          id: "4",
          name: "Partner portal",
          hub_category: null,
          status: null,
          document_link: "https://example.com/resource-center",
        },
      ],
      FIELDS,
      "media-table"
    )

    expect(items).toHaveLength(1)
    expect(items[0].fileType).toBe("LINK")
    expect(items[0].category).toBe("documents")
  })

  it("uses attachment URL for preview and file type when no document link exists", () => {
    const items = buildResourceHubItems(
      [
        {
          id: "5",
          name: "Brand hero image",
          hub_category: "Images",
          document_link: null,
          attachments: [
            {
              url: "https://cdn.example.com/assets/hero.jpg",
            },
          ],
        },
      ],
      FIELDS,
      "media-table"
    )

    expect(items).toHaveLength(1)
    expect(items[0].thumbnailUrl).toBe("https://cdn.example.com/assets/hero.jpg")
    expect(items[0].url).toBe("https://cdn.example.com/assets/hero.jpg")
    expect(items[0].fileType).toBe("JPG")
  })

  it("classifies uploaded PDF attachments as PDF, not external links", () => {
    const items = buildResourceHubItems(
      [
        {
          id: "6",
          name: "Brand guidelines PDF",
          hub_category: "Documents",
          document_link: null,
          attachments: [
            {
              url: "https://project.supabase.co/storage/v1/object/public/attachments/media/1/attachments/file.pdf",
              name: "brand-guidelines.pdf",
              type: "application/pdf",
            },
          ],
        },
      ],
      FIELDS,
      "media-table"
    )

    expect(items).toHaveLength(1)
    expect(items[0].fileType).toBe("PDF")
    expect(items[0].url).toContain("file.pdf")
  })

  it("treats storage uploads without extensions as documents, not external links", () => {
    const items = buildResourceHubItems(
      [
        {
          id: "7",
          name: "Uploaded asset",
          hub_category: "Documents",
          document_link: null,
          attachments: [
            {
              url: "https://project.supabase.co/storage/v1/object/public/attachments/media/1/attachments/abc-uuid",
              name: "briefing-pack.docx",
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          ],
        },
      ],
      FIELDS,
      "media-table"
    )

    expect(items).toHaveLength(1)
    expect(items[0].fileType).toBe("DOCX")
  })

  it("prefers attachment over reference link for preview and file type", () => {
    const items = buildResourceHubItems(
      [
        {
          id: "8",
          name: "Guideline pack",
          hub_category: "Documents",
          document_link: "https://example.com/resource-center",
          attachments: [
            {
              url: "https://project.supabase.co/storage/v1/object/public/attachments/media/1/attachments/guide.pdf",
              name: "guide.pdf",
              type: "application/pdf",
            },
          ],
        },
      ],
      FIELDS,
      "media-table"
    )

    expect(items).toHaveLength(1)
    expect(items[0].fileType).toBe("PDF")
    expect(items[0].url).toContain("guide.pdf")
    expect(items[0].referenceUrl).toBe("https://example.com/resource-center")
  })

  it("derives Google Drive thumbnail and source from document_link", () => {
    const fileId = "1-pHl-DXNlOPC4LuWneYmHB-fzHscofyS"
    const items = buildResourceHubItems(
      [
        {
          id: "drive-1",
          name: "Brand guidelines",
          hub_category: "Brand Guidelines",
          document_link: `https://drive.google.com/file/d/${fileId}/view`,
        },
      ],
      FIELDS,
      "media-table"
    )

    expect(items).toHaveLength(1)
    expect(items[0].source).toBe("Google Drive")
    expect(items[0].thumbnailUrl).toBe(
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`
    )
  })
})

describe("resource link helpers", () => {
  it("extracts Google Drive file id from /d/ URLs", () => {
    expect(
      extractGoogleDriveFileId("https://drive.google.com/file/d/abc123XYZ/view?usp=sharing")
    ).toBe("abc123XYZ")
  })

  it("resolves resource source from host", () => {
    expect(resolveResourceSource("https://drive.google.com/file/d/x/view")).toBe("Google Drive")
    expect(resolveResourceSource("https://contoso.sharepoint.com/sites/marketing")).toBe(
      "SharePoint"
    )
  })

  it("prefers Drive thumbnail when no attachment image exists", () => {
    const thumb = resolveResourceThumbnailUrl(
      "https://drive.google.com/open?id=file123",
      null
    )
    expect(thumb).toBe("https://drive.google.com/thumbnail?id=file123&sz=w600")
  })
})
