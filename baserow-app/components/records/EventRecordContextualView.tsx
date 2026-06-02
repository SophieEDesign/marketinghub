"use client"

import { EventDetailContent } from "@/components/interface/EventDetailPanel"
import type { EventRecordContextualPayload } from "@/lib/records/record-drawer-mode"

export interface EventRecordContextualViewProps {
  payload: EventRecordContextualPayload
  onClose: () => void
  onEdit: () => void
}

/**
 * Event overview inside RecordPanel (view mode). Reuses EventDetailContent without a second drawer.
 */
export default function EventRecordContextualView({
  payload,
  onClose,
  onEdit,
}: EventRecordContextualViewProps) {
  const {
    event,
    canEdit,
    isExternalView,
    showScheduleTab,
    showResourcesTab,
    showNotesTab,
    showAttendanceControls,
    allowCalendarExport,
    showApprovalActions,
    attendanceStatus,
    onAttendanceChange,
    onManageAttendees,
    onApprove,
    onReject,
  } = payload

  return (
    <EventDetailContent
      event={event}
      onClose={onClose}
      fitContent
      canEdit={canEdit}
      isExternalView={isExternalView}
      onEdit={onEdit}
      showScheduleTab={showScheduleTab}
      showResourcesTab={showResourcesTab}
      showNotesTab={showNotesTab}
      showAttendanceControls={showAttendanceControls}
      allowCalendarExport={allowCalendarExport}
      attendanceStatus={attendanceStatus}
      showApprovalActions={showApprovalActions}
      onAttendanceChange={onAttendanceChange}
      onManageAttendees={onManageAttendees}
      onApprove={onApprove}
      onReject={onReject}
    />
  )
}
