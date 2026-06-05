import type { RecordLayoutType } from "@/lib/records/record-layout-presets"

function normalizeTableToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

/**
 * Infer contextual drawer layout from a linked table's display or Supabase name.
 * Falls back to generic when no marketing layout matches.
 */
export function inferRecordLayoutTypeFromTableName(
  tableName: string | null | undefined
): RecordLayoutType {
  if (!tableName?.trim()) return "generic"

  const n = normalizeTableToken(tableName)

  if (/social.*post|social_post/.test(n)) return "social_post"
  if (/^events?$|marketing_events|event_calendar/.test(n)) return "event"
  if (/campaign/.test(n)) return "campaign"
  if (/task|things_to_do|todo|to_do/.test(n)) return "task"
  if (/media|resource|asset|brand/.test(n)) return "asset"
  if (/content|social/.test(n)) return "content"

  return "generic"
}
