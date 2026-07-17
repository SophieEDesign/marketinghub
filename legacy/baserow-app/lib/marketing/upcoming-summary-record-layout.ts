import type { UpcomingSummarySectionId } from "@/lib/interface/types"
import type { RecordLayoutType } from "@/lib/records/record-layout-presets"

/**
 * Maps Upcoming Summary section clicks to contextual record drawer layouts.
 * Returns undefined for sections that should use generic drawer fallback.
 */
export function resolveUpcomingSummaryRecordLayoutType(
  section: UpcomingSummarySectionId
): RecordLayoutType | undefined {
  switch (section) {
    case "campaigns":
      return "campaign"
    case "events":
      return "event"
    case "published":
      return "content"
    case "deadlines":
    case "approval":
    case "blockers":
      return "task"
    default:
      return undefined
  }
}
