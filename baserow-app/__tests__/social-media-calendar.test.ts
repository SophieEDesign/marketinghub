import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { BLOCK_REGISTRY, getAllBlockTypes } from "@/lib/interface/registry"
import {
  applyContentScope,
  buildSocialCalendarItems,
  derivePlatforms,
  externalLinkLabel,
  filterSocialCalendarItems,
  normalizeExternalUrl,
  normalizeSocialStatus,
  parseContentMediaThumbnail,
  socialCalendarDateFieldValue,
  socialCalendarSettingsFromConfig,
  type SocialCalendarFieldMap,
  type SocialCalendarItem,
} from "@/lib/marketing/social-media-calendar"

const baseFields: SocialCalendarFieldMap = {
  contentName: "content_name",
  contentDate: "date",
  contentDueDate: null,
  contentStatus: "status",
  contentType: "content_type",
  contentTheme: null,
  contentCampaign: null,
  contentOwner: null,
  contentDivision: null,
  isArchived: null,
  deletedAt: null,
  campaignName: "name",
  campaignStatus: null,
  campaignContent: null,
  campaignTheme: null,
  themeName: "name",
  themeQuarter: null,
  themeYear: null,
  themeColor: null,
  themeDivisions: null,
  caption: "content_post_text",
  images: "images",
  channels: "channels",
  schedule: "schedule",
  approvalNotes: "notes_detail",
  instagram: "instagram",
  linkedin: "linkedin",
  twitter: "twitter",
  facebook: "facebook",
  tiktok: "tiktok",
  postUrl: "planable_url",
}

function makeItem(overrides: Partial<SocialCalendarItem> = {}): SocialCalendarItem {
  return {
    id: "1",
    title: "Test post",
    date: new Date(2026, 4, 15),
    dueDate: null,
    status: "Draft",
    contentType: "Social Media",
    themeId: null,
    themeLabel: null,
    campaignIds: [],
    assignee: null,
    division: null,
    accentColor: "#7c3aed",
    isOverdue: false,
    isUpcoming: true,
    platforms: ["instagram"],
    scheduledTime: "10:00 AM",
    caption: "Hello world",
    captionSnippet: "Hello world",
    thumbnailUrl: null,
    mediaUrls: [],
    hasMedia: false,
    campaignLabel: null,
    approvalNotes: null,
    normalizedStatus: "draft",
    statusLabel: "Draft",
    missingMedia: true,
    needsReview: false,
    postUrl: null,
    ...overrides,
  }
}

describe("social_media_calendar block registration", () => {
  it("is registered in BLOCK_REGISTRY with full-page support", () => {
    const def = BLOCK_REGISTRY.social_media_calendar
    expect(def).toBeDefined()
    expect(def?.type).toBe("social_media_calendar")
    expect(def?.label).toBe("Social Media Calendar")
    expect(def?.defaultWidth).toBe(12)
    expect(def?.supportsFullPage).toBe(true)
    expect(def?.defaultConfig?.social_media_calendar_content_scope).toBe("social_only")
  })

  it("is included in getAllBlockTypes", () => {
    expect(getAllBlockTypes()).toContain("social_media_calendar")
  })
})

describe("socialCalendarSettingsFromConfig", () => {
  it("parses block config defaults", () => {
    const settings = socialCalendarSettingsFromConfig({
      title: "Social Calendar",
      social_media_calendar_default_view: "feed",
      social_media_calendar_content_scope: "all_content",
      social_media_calendar_mode: "compact",
      social_media_calendar_show_status_bar: false,
    })
    expect(settings.title).toBe("Social Calendar")
    expect(settings.defaultView).toBe("feed")
    expect(settings.contentScope).toBe("all_content")
    expect(settings.mode).toBe("compact")
    expect(settings.showStatusBar).toBe(false)
  })
})

describe("InterfacePageClient routing", () => {
  it("does not use a bespoke Social Media Calendar dashboard bypass", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/InterfacePageClient.tsx"),
      "utf8"
    )
    expect(src).not.toContain("showSocialMediaCalendar")
    expect(src).not.toContain("SocialMediaCalendarDashboard")
    expect(src).not.toContain("isSocialMediaCalendarPage")
    expect(src).not.toContain("layout_style: \"social_media_calendar\"")
    expect(src).not.toContain("social_media_calendar")
  })

  it("renders social calendar via BlockRenderer", () => {
    const src = readFileSync(
      join(process.cwd(), "components/interface/BlockRenderer.tsx"),
      "utf8"
    )
    expect(src).toContain('case "social_media_calendar"')
    expect(src).toContain("SocialMediaCalendarBlock")
  })
})

describe("normalizeSocialStatus", () => {
  it("maps review and draft synonyms", () => {
    expect(normalizeSocialStatus("Needs Review")).toBe("needs_review")
    expect(normalizeSocialStatus("To Do")).toBe("draft")
    expect(normalizeSocialStatus("Scheduled")).toBe("scheduled")
    expect(normalizeSocialStatus("Published")).toBe("published")
  })
})

describe("derivePlatforms", () => {
  it("reads channels array", () => {
    const platforms = derivePlatforms({
      channels: ["Instagram", "LinkedIn"],
      contentType: null,
      row: {},
      fields: baseFields,
    })
    expect(platforms).toContain("instagram")
    expect(platforms).toContain("linkedin")
  })
})

describe("parseContentMediaThumbnail", () => {
  it("parses json array of urls", () => {
    const result = parseContentMediaThumbnail([
      { url: "https://example.com/a.jpg" },
      "https://example.com/b.jpg",
    ])
    expect(result.thumbnailUrl).toBe("https://example.com/a.jpg")
    expect(result.mediaUrls).toHaveLength(2)
  })
})

describe("applyContentScope", () => {
  it("filters to social by default scope", () => {
    const items = [
      makeItem({ id: "a", contentType: "Social Media" }),
      makeItem({ id: "b", contentType: "Blog", platforms: [] }),
    ]
    const social = applyContentScope(items, "social_only")
    expect(social.map((i) => i.id)).toEqual(["a"])
  })
})

describe("filterSocialCalendarItems", () => {
  it("filters by platform", () => {
    const items = [
      makeItem({ id: "a", platforms: ["instagram"] }),
      makeItem({ id: "b", platforms: ["linkedin"] }),
    ]
    const filtered = filterSocialCalendarItems(items, {
      year: 2026,
      quarter: "all",
      contentTypes: [],
      divisions: [],
      statuses: [],
      search: "",
      platforms: ["instagram"],
      themes: [],
      owners: [],
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("a")
  })
})

describe("socialCalendarDateFieldValue", () => {
  it("formats as local yyyy-MM-dd", () => {
    expect(socialCalendarDateFieldValue(new Date(2026, 5, 15, 14, 30))).toBe("2026-06-15")
  })
})

describe("Planable / post URL", () => {
  it("normalizes bare domains to https", () => {
    expect(normalizeExternalUrl("app.planable.io/post/abc")).toBe(
      "https://app.planable.io/post/abc"
    )
  })

  it("labels Planable hosts", () => {
    expect(externalLinkLabel("https://app.planable.io/post/abc")).toBe("Open in Planable")
    expect(externalLinkLabel("https://example.com/post")).toBe("Open post link")
  })

  it("reads post URL from content rows", () => {
    const baseItems = [
      {
        id: "1",
        title: "Post",
        date: new Date(2026, 4, 15),
        dueDate: null,
        status: "Draft",
        contentType: "Social Media",
        themeId: null,
        themeLabel: null,
        campaignIds: [],
        assignee: null,
        division: null,
        accentColor: "#7c3aed",
        isOverdue: false,
        isUpcoming: true,
      },
    ]
    const items = buildSocialCalendarItems({
      baseItems,
      contentRows: [{ id: "1", planable_url: "https://app.planable.io/post/xyz" }],
      fields: baseFields,
      campaignLabelById: new Map(),
    })
    expect(items[0].postUrl).toBe("https://app.planable.io/post/xyz")
  })
})
