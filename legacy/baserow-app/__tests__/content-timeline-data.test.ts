import { describe, it, expect } from "vitest"
import { resolveContentPlanningFields } from "@/lib/marketing/content-planning"
import { buildContentTimelineItems } from "@/lib/marketing/content-timeline-data"
import { resolveContentTimelineExtraFields } from "@/lib/marketing/block-config-resolver"

const CONTENT_FIELDS = [
  { name: "content_name", type: "text" },
  { name: "content_type", type: "single_select" },
  { name: "status", type: "single_select" },
  { name: "date", type: "date" },
  { name: "date_due", type: "date" },
  { name: "date_to", type: "date" },
  { name: "quarterly_theme", type: "text" },
  { name: "channels", type: "multi_select" },
]

describe("buildContentTimelineItems", () => {
  const fieldMap = resolveContentPlanningFields(CONTENT_FIELDS, [], [])
  const extraFields = resolveContentTimelineExtraFields(
    CONTENT_FIELDS.map((f) => ({ id: f.name, name: f.name }))
  )

  it("includes rows with only date_due when date is empty", () => {
    const rows = [
      {
        id: "r1",
        content_name: "Newsletter",
        content_type: "Newsletter",
        status: "Planned",
        date_due: "2026-06-15",
      },
    ]
    const planningItems = [
      {
        id: "r1",
        title: "Newsletter",
        date: null,
        dueDate: new Date("2026-06-15T00:00:00"),
        status: "Planned",
        contentType: "Newsletter",
        themeId: null,
        themeLabel: "Q2 Brand",
        campaignIds: [],
        assignee: null,
        division: null,
        accentColor: "#6D4AFF",
        isOverdue: false,
        isUpcoming: true,
      },
    ]

    const items = buildContentTimelineItems({
      contentRows: rows,
      fields: fieldMap,
      contentFields: CONTENT_FIELDS,
      extraFields,
      planningItems,
      themeLabelById: new Map(),
      campaignLabelById: new Map(),
      profileLabelById: new Map(),
      contentTableId: "t1",
      contentSupabaseTable: "table_content_x",
    })

    expect(items).toHaveLength(1)
    expect(items[0].startDate).toBe("2026-06-15")
    expect(items[0].theme).toBe("Q2 Brand")
  })

  it("resolves theme label from text field when not a linked UUID", () => {
    const rows = [
      {
        id: "r2",
        content_name: "Blog post",
        content_type: "Blog",
        status: "Draft",
        date: "2026-07-01",
        quarterly_theme: "Summer Campaign",
      },
    ]
    const planningItems = [
      {
        id: "r2",
        title: "Blog post",
        date: new Date("2026-07-01T00:00:00"),
        dueDate: null,
        status: "Draft",
        contentType: "Blog",
        themeId: "Summer Campaign",
        themeLabel: "Summer Campaign",
        campaignIds: [],
        assignee: null,
        division: null,
        accentColor: "#6D4AFF",
        isOverdue: false,
        isUpcoming: false,
      },
    ]

    const items = buildContentTimelineItems({
      contentRows: rows,
      fields: fieldMap,
      contentFields: CONTENT_FIELDS,
      extraFields,
      planningItems,
      themeLabelById: new Map(),
      campaignLabelById: new Map(),
      profileLabelById: new Map(),
      contentTableId: "t1",
      contentSupabaseTable: "table_content_x",
    })

    expect(items[0].theme).toBe("Summer Campaign")
  })

  it("skips archived rows via planningItems guard", () => {
    const rows = [
      {
        id: "r3",
        content_name: "Hidden",
        date: "2026-07-01",
        is_archived: true,
      },
    ]

    const items = buildContentTimelineItems({
      contentRows: rows,
      fields: fieldMap,
      contentFields: [...CONTENT_FIELDS, { name: "is_archived", type: "checkbox" }],
      extraFields,
      planningItems: [],
      themeLabelById: new Map(),
      campaignLabelById: new Map(),
      profileLabelById: new Map(),
      contentTableId: "t1",
      contentSupabaseTable: "table_content_x",
    })

    expect(items).toHaveLength(0)
  })
})
