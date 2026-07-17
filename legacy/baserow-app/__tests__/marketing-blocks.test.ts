import { describe, it, expect } from "vitest"
import {
  assignRowGroup,
  filterThingsToDoItems,
  groupThingsToDoItems,
  EMPTY_THINGS_TO_DO_FILTERS,
  type ThingsToDoItem,
} from "@/lib/marketing/things-to-do"
import {
  filterContentTimelineItems,
  itemOverlapsView,
  type ContentTimelineItem,
} from "@/lib/marketing/content-timeline"
import {
  filterDeadlinesByRange,
  getVisibleSections,
  sliceItems,
  MOCK_DEADLINES,
} from "@/lib/interface/upcoming-summary-mock-data"

function minimalTodo(overrides: Partial<ThingsToDoItem> = {}): ThingsToDoItem {
  return {
    id: "t1",
    title: "Test task",
    type: "task",
    status: "to-do",
    priority: "medium",
    dueDate: "2025-05-22",
    ...overrides,
  }
}

describe("groupThingsToDoItems", () => {
  const items = [
    minimalTodo({ id: "a", status: "to-do", priority: "high" }),
    minimalTodo({ id: "b", status: "done", priority: "low", dueDate: "2025-05-10" }),
    minimalTodo({
      id: "c",
      status: "in-progress",
      campaign: { id: "camp-1", title: "ARC 2026" },
    }),
  ]

  it("groups by due-date sections by default", () => {
    const sections = groupThingsToDoItems(items, "due-date", new Date("2025-05-22"))
    expect(sections.length).toBeGreaterThan(0)
    expect(sections.some((s) => s.key === "completed")).toBe(true)
  })

  it("groups by status", () => {
    const sections = groupThingsToDoItems(items, "status")
    const keys = sections.map((s) => s.key)
    expect(keys).toContain("to-do")
    expect(keys).toContain("done")
  })

  it("groups by campaign", () => {
    const sections = groupThingsToDoItems(items, "campaign")
    expect(sections.some((s) => s.label === "ARC 2026")).toBe(true)
  })

  it("groups by priority", () => {
    const sections = groupThingsToDoItems(items, "priority")
    const keys = sections.map((s) => s.key)
    expect(keys).toContain("high")
    expect(keys).toContain("low")
  })
})

describe("filterThingsToDoItems", () => {
  it("filters by status chip", () => {
    const items = [
      minimalTodo({ id: "1", status: "to-do" }),
      minimalTodo({ id: "2", status: "in-progress" }),
    ]
    const filtered = filterThingsToDoItems(
      items,
      EMPTY_THINGS_TO_DO_FILTERS,
      "",
      "all",
      "in-progress"
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("2")
  })
})

describe("assignRowGroup", () => {
  it("marks overdue items", () => {
    const group = assignRowGroup(
      minimalTodo({ dueDate: "2020-01-01", status: "to-do" }),
      new Date("2025-05-22")
    )
    expect(group).toBe("overdue")
  })
})

describe("upcoming summary mock helpers", () => {
  it("sliceItems respects max up to 20", () => {
    const sliced = sliceItems([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 8)
    expect(sliced).toHaveLength(8)
  })

  it("filterDeadlinesByRange returns subset for next_30_days", () => {
    const filtered = filterDeadlinesByRange(MOCK_DEADLINES, "next_30_days", new Date("2025-05-20"))
    expect(filtered.length).toBeLessThanOrEqual(MOCK_DEADLINES.length)
  })

  it("getVisibleSections respects config", () => {
    const sections = getVisibleSections({
      upcoming_summary_sections: ["deadlines", "events"],
    })
    expect(sections).toEqual(["deadlines", "events"])
  })
})

describe("filterContentTimelineItems", () => {
  const sample: ContentTimelineItem = {
    id: "ct-1",
    title: "Post",
    theme: "ARC 2026",
    type: "social-post",
    channel: "linkedin",
    status: "draft",
    startDate: "2025-05-01",
    endDate: "2025-05-10",
    owner: "Alex",
    division: "Marketing",
  }

  it("filters by theme", () => {
    const result = filterContentTimelineItems([sample], {
      themes: ["ARC 2026"],
      types: [],
      channels: [],
      statuses: [],
      owners: [],
      divisions: [],
      search: "",
    })
    expect(result).toHaveLength(1)
  })

  it("itemOverlapsView returns false outside anchor month", () => {
    const overlaps = itemOverlapsView(
      sample,
      "month",
      new Date("2025-08-01")
    )
    expect(overlaps).toBe(false)
  })
})
