import { describe, expect, it } from "vitest"
import {
  isPlanableSyncMetadataField,
  MAKE_SCENARIO_3_FILTER,
  PLANABLE_SYNC_FIELDS,
  withPlanableHubSyncPatch,
} from "@/lib/marketing/planable-sync"

describe("planable-sync", () => {
  it("treats last_synced_at and sync_source as metadata", () => {
    expect(isPlanableSyncMetadataField("last_synced_at")).toBe(true)
    expect(isPlanableSyncMetadataField("sync_source")).toBe(true)
    expect(isPlanableSyncMetadataField("caption")).toBe(false)
  })

  it("adds sync_source hub on user field edits", () => {
    expect(
      withPlanableHubSyncPatch(
        { caption: "Hello" },
        { fieldName: "caption", hasSyncSourceColumn: true }
      )
    ).toEqual({ caption: "Hello", sync_source: "hub" })
  })

  it("does not add sync_source when editing metadata fields", () => {
    expect(
      withPlanableHubSyncPatch(
        { last_synced_at: "2026-01-01T00:00:00Z" },
        { fieldName: "last_synced_at", hasSyncSourceColumn: true }
      )
    ).toEqual({ last_synced_at: "2026-01-01T00:00:00Z" })
  })

  it("includes planable_post_id in scenario 3 filter", () => {
    expect(MAKE_SCENARIO_3_FILTER).toContain(PLANABLE_SYNC_FIELDS.postId)
    expect(MAKE_SCENARIO_3_FILTER).toContain("planable")
  })
})
