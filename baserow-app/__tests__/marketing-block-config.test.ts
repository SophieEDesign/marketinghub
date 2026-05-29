import { describe, it, expect } from "vitest"
import {
  fieldNameFromConfig,
  marketingDemoState,
  resolveMarketingTable,
} from "@/lib/marketing/block-config-resolver"
import { validateBlockConfig } from "@/lib/interface/block-config-types"
import type { BlockConfig } from "@/lib/interface/types"
import {
  findContentTable,
  resolveContentTimelineSourceTables,
  type MarketingTableRow,
} from "@/lib/marketing/marketing-tables"

const REGISTRY: MarketingTableRow[] = [
  { id: "t-content", name: "Content", supabase_table: "content_rows" },
  { id: "t-campaigns", name: "Campaigns", supabase_table: "campaigns_rows" },
  { id: "t-social", name: "Social Posts", supabase_table: "social_posts_rows" },
]

const FIELDS = [
  { id: "f1", name: "content_name" },
  { id: "f2", name: "status" },
]

describe("fieldNameFromConfig", () => {
  it("prefers field_id over field name", () => {
    expect(fieldNameFromConfig(FIELDS, "f2", "content_name")).toBe("status")
  })

  it("falls back to stored field name", () => {
    expect(fieldNameFromConfig(FIELDS, undefined, "content_name")).toBe("content_name")
  })

  it("falls back to stored name even when field id is missing", () => {
    expect(fieldNameFromConfig(FIELDS, "missing", "also_missing")).toBe("also_missing")
  })
})

describe("resolveContentTimelineSourceTables", () => {
  it("merges Content and Social Posts when auto-discovering", () => {
    const tables = resolveContentTimelineSourceTables(REGISTRY)
    expect(tables.map((t) => t.id)).toEqual(["t-content", "t-social"])
  })

  it("uses only explicit table_id when set", () => {
    const tables = resolveContentTimelineSourceTables(REGISTRY, {
      tableId: "t-social",
    })
    expect(tables.map((t) => t.id)).toEqual(["t-social"])
  })
})

describe("resolveMarketingTable", () => {
  it("uses table_id when set", () => {
    const row = resolveMarketingTable(REGISTRY, "t-campaigns", findContentTable)
    expect(row?.id).toBe("t-campaigns")
  })

  it("falls back to name discovery", () => {
    const row = resolveMarketingTable(REGISTRY, "", findContentTable)
    expect(row?.id).toBe("t-content")
  })
})

describe("marketingDemoState", () => {
  it("forces demo when use_mock", () => {
    const s = marketingDemoState({ forceMock: true, fromLiveData: false, hasTable: false })
    expect(s.useDemoData).toBe(true)
    expect(s.showDemoBanner).toBe(true)
  })

  it("uses live data when fromLiveData", () => {
    const s = marketingDemoState({ forceMock: false, fromLiveData: true, hasTable: true })
    expect(s.useLiveData).toBe(true)
    expect(s.useDemoData).toBe(false)
  })

  it("shows empty state when unconfigured", () => {
    const s = marketingDemoState({ forceMock: false, fromLiveData: false, hasTable: false })
    expect(s.showEmptyState).toBe(true)
    expect(s.useDemoData).toBe(false)
  })

  it("shows error empty when table configured but load failed", () => {
    const s = marketingDemoState({
      forceMock: false,
      fromLiveData: false,
      hasTable: true,
      error: "Network error",
    })
    expect(s.showEmptyState).toBe(true)
    expect(s.useDemoData).toBe(false)
  })
})

const MARKETING_TYPES = [
  "content_timeline",
  "things_to_do",
  "upcoming_summary",
  "internal_resource_hub",
  "social_media_calendar",
  "event_calendar",
  "content_theme",
  "campaigns_overview",
] as const

describe("validateBlockConfig marketing blocks", () => {
  it("allows saving with table_id and field mapping keys", () => {
    const config: BlockConfig = {
      title: "Test",
      table_id: "t-content",
      view_id: "v1",
      content_timeline_use_mock: false,
      content_timeline_title_field_id: "f1",
      content_timeline_title_field: "content_name",
      content_timeline_max_items: 50,
    }
    const result = validateBlockConfig("content_timeline", config)
    expect(result.valid).toBe(true)
  })

  it("validates all marketing custom types without required table_id", () => {
    for (const type of MARKETING_TYPES) {
      const result = validateBlockConfig(type, { title: "Block" })
      expect(result.valid).toBe(true)
    }
  })
})
