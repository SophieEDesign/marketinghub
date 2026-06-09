import { describe, it, expect } from "vitest"
import { resolveSelectFilterStoredValues } from "@/lib/fields/select-options"

const postTypeOptions = {
  choices: ["Social Post", "editorial", "sponsorship", "newsletter", "content"],
  selectOptions: [
    {
      id: "1a7ace74-4c8a-43e9-93ab-32ca0cfe7930",
      label: "Social Post",
      sort_index: 0,
      created_at: "2026-06-01T13:37:16.276Z",
    },
    {
      id: "71a1ed6c-f6e8-4800-aa57-4fa0c19afa5d",
      label: "editorial",
      sort_index: 1,
      created_at: "2026-06-01T13:37:16.276Z",
    },
  ],
}

describe("resolveSelectFilterStoredValues", () => {
  it("includes stored slug when filter uses select label", () => {
    const values = resolveSelectFilterStoredValues(
      "Social Post",
      "single_select",
      postTypeOptions
    )
    expect(values).toContain("social_post")
    expect(values).toContain("Social Post")
  })

  it("keeps literal editorial slug", () => {
    const values = resolveSelectFilterStoredValues(
      "editorial",
      "single_select",
      postTypeOptions
    )
    expect(values).toContain("editorial")
  })
})
