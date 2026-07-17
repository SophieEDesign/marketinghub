import type { SupabaseClient } from "@supabase/supabase-js"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import { formatUserDisplayName } from "@/lib/users/userDisplay"

type ProfileRow = {
  id: string
  user_id: string | null
  email: string | null
}

type SyncRow = {
  user_id: string
  profile_id: string | null
  email: string | null
}

/**
 * Human-readable label from profile email (e.g. sophie.edgerley@… → Sophie Edgerley).
 */
export function profileLabelFromEmail(email: string | null | undefined): string {
  const raw = formatDisplayValue(email)
  if (!raw) return ""
  if (raw.includes("@")) return formatUserDisplayName(raw)
  return raw
}

function setLabel(map: Map<string, string>, key: string | null | undefined, label: string) {
  if (!key || !label) return
  map.set(String(key), label)
}

/**
 * Map profile / auth user ids to display labels (full name from email when no name column).
 * Keys both profiles.id and profiles.user_id so linked-field ids resolve either way.
 */
export async function fetchProfileLabelById(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  const { data: syncRows, error: syncErr } = await supabase
    .from("user_profile_sync_status")
    .select("user_id, profile_id, email")

  if (!syncErr && syncRows?.length) {
    for (const row of syncRows as SyncRow[]) {
      const label = profileLabelFromEmail(row.email)
      if (!label) continue
      setLabel(map, row.user_id, label)
      setLabel(map, row.profile_id, label)
    }
    if (map.size > 0) return map
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, user_id, email")

  if (error) {
    console.warn("[fetchProfileLabelById] profiles query failed:", error.message)
    return map
  }

  for (const p of (profiles || []) as ProfileRow[]) {
    const label =
      profileLabelFromEmail(p.email) ||
      formatUserDisplayName(p.email) ||
      ""
    if (!label) continue
    setLabel(map, p.id, label)
    setLabel(map, p.user_id, label)
  }

  return map
}

/** Resolve a single user/profile id to a display label. */
export function profileLabelForId(
  profileLabelById: Map<string, string>,
  id: string
): string {
  return profileLabelById.get(id) || formatUserDisplayName(null)
}
