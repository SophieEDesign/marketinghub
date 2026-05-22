import type { SupabaseClient } from "@supabase/supabase-js"
import { formatDisplayValue } from "@/lib/marketing/field-utils"

type ProfileRow = {
  id: string
  user_id: string | null
  email: string | null
}

/**
 * Map profile / auth user ids to display labels (email local-part fallback).
 * Keys both profiles.id and profiles.user_id so linked-field ids resolve either way.
 */
export async function fetchProfileLabelById(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, user_id, email")

  if (error) {
    console.warn("[fetchProfileLabelById] profiles query failed:", error.message)
    return map
  }

  for (const p of (profiles || []) as ProfileRow[]) {
    const emailLabel = formatDisplayValue(p.email)
    const label =
      emailLabel ||
      (p.email?.split("@")[0] ?? "") ||
      String(p.user_id || p.id).slice(0, 8)

    if (p.id) map.set(String(p.id), label)
    if (p.user_id) map.set(String(p.user_id), label)
  }

  return map
}
