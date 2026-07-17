/** Planable ↔ Make sync field names on Social Posts. */
export const PLANABLE_SYNC_FIELDS = {
  postId: "planable_post_id",
  url: "planable_url",
  status: "planable_status",
  lastSyncedAt: "last_synced_at",
  syncSource: "sync_source",
} as const

/** Written by Make after Planable poll; Hub→Planable scenario should skip these-only updates. */
export const PLANABLE_SYNC_METADATA_FIELDS = new Set<string>([
  PLANABLE_SYNC_FIELDS.lastSyncedAt,
  PLANABLE_SYNC_FIELDS.syncSource,
])

export const PLANABLE_SYNC_SOURCE = {
  hub: "hub",
  planable: "planable",
} as const

export function isPlanableSyncMetadataField(fieldName: string): boolean {
  return PLANABLE_SYNC_METADATA_FIELDS.has(fieldName)
}

/** Mark a user-originated edit so Make Scenario 3 can push to Planable. */
export function withPlanableHubSyncPatch<T extends Record<string, unknown>>(
  patch: T,
  options: {
    fieldName?: string
    hasSyncSourceColumn: boolean
  }
): T & { sync_source?: string } {
  if (!options.hasSyncSourceColumn) return patch
  if (options.fieldName && isPlanableSyncMetadataField(options.fieldName)) return patch
  return { ...patch, sync_source: PLANABLE_SYNC_SOURCE.hub }
}

export type PlanableSyncConfig = {
  socialPostsTable: string | null
  socialPostsTableId: string | null
  fields: typeof PLANABLE_SYNC_FIELDS
  makeScenario3Filter: string
  planableApiBaseUrl: string
}

export const PLANABLE_API_BASE_URL = "https://api.planable.io/api/v1"

/** Make router filter (copy into Scenario 3). */
export const MAKE_SCENARIO_3_FILTER = [
  `{{${PLANABLE_SYNC_FIELDS.postId}}} is not empty`,
  `{{${PLANABLE_SYNC_FIELDS.syncSource}}} != "${PLANABLE_SYNC_SOURCE.planable}"`,
  `{{${PLANABLE_SYNC_FIELDS.lastSyncedAt}}} is empty OR {{updated_at}} > {{${PLANABLE_SYNC_FIELDS.lastSyncedAt}}}`,
].join("\nAND ")
