import { describe, it, expect } from "vitest"
import { buildUpcomingSummaryData } from "@/lib/marketing/upcoming-summary-data"
import { resolveContentPlanningFields } from "@/lib/marketing/content-planning"
import { filterDeadlinesByRange } from "@/lib/interface/upcoming-summary-mock-data"

const contentFields = [
  { name: "content_name", type: "text" },
  { name: "content_type", type: "single_select" },
  { name: "status", type: "single_select" },
  { name: "date_due", type: "date" },
  { name: "date", type: "date" },
  { name: "images", type: "attachment" },
  { name: "notes", type: "long_text" },
]

const campaignFields = [{ name: "name", type: "text" }, { name: "status", type: "single_select" }]

describe("buildUpcomingSummaryData", () => {
  const fields = resolveContentPlanningFields(contentFields, campaignFields, [])

  it("maps content due dates to deadlines and skips event rows", () => {
    const built = buildUpcomingSummaryData({
      contentRows: [
        {
          id: "c1",
          content_name: "Newsletter draft",
          content_type: "Newsletter",
          status: "In progress",
          date_due: "2025-06-15",
          images: ["x"],
          notes: "Brief ok",
        },
        {
          id: "c2",
          content_name: "Boat Show",
          content_type: "Event",
          status: "Confirmed",
          date: "2025-06-20",
        },
      ],
      campaignRows: [],
      fields,
      contentFields,
      campaignFieldRows: campaignFields,
      themeLabelById: new Map(),
      profileLabelById: new Map(),
      contentTableId: "tbl-content",
      contentSupabaseTable: "table_content_x",
      campaignsTableId: "tbl-campaigns",
      campaignsSupabaseTable: "table_campaigns_x",
    })

    expect(built.deadlines.some((d) => d.id === "c1")).toBe(true)
    expect(built.deadlines.some((d) => d.id === "c2")).toBe(false)
    expect(built.events.some((e) => e.id === "c2")).toBe(true)
    expect(built.deadlines[0].recordTableId).toBe("tbl-content")
  })

  it("maps published rows and approval queue", () => {
    const built = buildUpcomingSummaryData({
      contentRows: [
        {
          id: "p1",
          content_name: "Live post",
          status: "Published",
          date: "2025-05-10",
        },
        {
          id: "a1",
          content_name: "Press release",
          status: "Awaiting approval",
          date_due: "2025-06-01",
          images: [],
          notes: "",
        },
      ],
      campaignRows: [],
      fields,
      contentFields,
      campaignFieldRows: campaignFields,
      themeLabelById: new Map(),
      profileLabelById: new Map(),
      contentTableId: "tbl-content",
      contentSupabaseTable: "table_content_x",
      campaignsTableId: "tbl-campaigns",
      campaignsSupabaseTable: "table_campaigns_x",
    })

    expect(built.published.some((p) => p.id === "p1")).toBe(true)
    expect(built.approval.some((a) => a.id === "a1")).toBe(true)
    expect(built.deadlines.some((d) => d.id === "a1")).toBe(false)
  })

  it("aggregates campaign content counts", () => {
    const built = buildUpcomingSummaryData({
      contentRows: [
        {
          id: "x1",
          content_name: "Post A",
          status: "Scheduled",
          campaigns: "camp-1",
        },
        {
          id: "x2",
          content_name: "Post B",
          status: "Approved",
          campaigns: "camp-1",
        },
      ],
      campaignRows: [{ id: "camp-1", name: "Summer push", status: "In progress" }],
      fields: {
        ...fields,
        contentCampaign: "campaigns",
      },
      contentFields,
      campaignFieldRows: campaignFields,
      themeLabelById: new Map(),
      profileLabelById: new Map(),
      contentTableId: "tbl-content",
      contentSupabaseTable: "table_content_x",
      campaignsTableId: "tbl-campaigns",
      campaignsSupabaseTable: "table_campaigns_x",
    })

    const camp = built.campaigns.find((c) => c.id === "camp-1")
    expect(camp?.title).toBe("Summer push")
    expect(camp?.plannedCount).toBe(2)
    expect(camp?.recordTableId).toBe("tbl-campaigns")
  })
})

describe("filterDeadlinesByRange with live-shaped items", () => {
  it("filters by next_30_days from built deadlines", () => {
    const built = buildUpcomingSummaryData({
      contentRows: [
        {
          id: "d1",
          content_name: "Soon",
          status: "To do",
          date_due: "2099-05-15",
          images: ["a"],
          notes: "n",
        },
      ],
      campaignRows: [],
      fields: resolveContentPlanningFields(contentFields, campaignFields, []),
      contentFields,
      campaignFieldRows: campaignFields,
      themeLabelById: new Map(),
      profileLabelById: new Map(),
      contentTableId: "t",
      contentSupabaseTable: "st",
      campaignsTableId: "t",
      campaignsSupabaseTable: "st",
    })
    const filtered = filterDeadlinesByRange(built.deadlines, "next_30_days", new Date("2099-05-01"))
    expect(filtered.length).toBe(1)
  })
})
