import type { EventAttendanceStatus, MarketingEventItem } from "@/lib/marketing/events"
import type { RecordLayoutType } from "@/lib/records/record-layout-presets"

export type RecordDrawerMode = "view" | "edit"

/** Rich event overview payload when opening from Event Calendar block. */
export interface EventRecordContextualPayload {
  event: MarketingEventItem
  canEdit: boolean
  isExternalView?: boolean
  showScheduleTab?: boolean
  showResourcesTab?: boolean
  showNotesTab?: boolean
  showAttendanceControls?: boolean
  allowCalendarExport?: boolean
  showApprovalActions?: boolean
  attendanceStatus?: EventAttendanceStatus | null
  onAttendanceChange?: (status: EventAttendanceStatus) => void
  onManageAttendees?: () => void
  onApprove?: () => void
  onReject?: () => void
}

export function defaultRecordDrawerMode(
  recordLayoutType?: RecordLayoutType,
  initialMode?: RecordDrawerMode
): RecordDrawerMode {
  if (initialMode) return initialMode
  if (recordLayoutType === "event" || recordLayoutType === "social_post") return "view"
  return "edit"
}

export function usesContextualDrawerView(
  recordLayoutType: RecordLayoutType | undefined,
  recordDrawerMode: RecordDrawerMode
): boolean {
  return recordLayoutType === "event" && recordDrawerMode === "view"
}
