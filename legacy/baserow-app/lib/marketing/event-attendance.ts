/**
 * Event Attendance — merge DB rows with marketing event items and legacy attendee arrays.
 */

import type { EventAttendanceStatus, MarketingEventItem } from "@/lib/marketing/events"

export interface EventAttendanceRow {
  event_id: string
  user_id: string
  attendance_status: EventAttendanceStatus
}

export function mergeAttendanceIntoEventItems(
  items: MarketingEventItem[],
  rows: EventAttendanceRow[],
  currentUserId: string | null,
  profileLabelById?: Map<string, string>
): MarketingEventItem[] {
  const byEvent = new Map<string, EventAttendanceRow[]>()
  for (const row of rows) {
    const list = byEvent.get(row.event_id) || []
    list.push(row)
    byEvent.set(row.event_id, list)
  }

  return items.map((item) => {
    const eventRows = byEvent.get(item.id) || []
    const attendingIds = [
      ...new Set([
        ...eventRows.filter((r) => r.attendance_status === "attending").map((r) => r.user_id),
        ...item.attendeeIds,
      ]),
    ]
    const userRow = currentUserId
      ? eventRows.find((r) => r.user_id === currentUserId)
      : undefined
    const currentUserAttendanceStatus: EventAttendanceStatus | null =
      userRow?.attendance_status ??
      item.currentUserAttendanceStatus ??
      (item.currentUserAttending ? "attending" : null)

    const labelFor = (id: string) => {
      const fromProfile = profileLabelById?.get(id)
      if (fromProfile) return fromProfile
      const prevIndex = item.attendeeIds.indexOf(id)
      const existing = prevIndex >= 0 ? item.attendeeLabels[prevIndex] : undefined
      if (existing && existing.length > 2 && !/^[0-9a-f-]{8}$/i.test(existing)) {
        return existing
      }
      return existing || id.slice(0, 8)
    }

    return {
      ...item,
      attendeeIds: attendingIds,
      attendeeCount: attendingIds.length,
      attendeeLabels: attendingIds.map((id) => labelFor(id)),
      currentUserAttending: currentUserId ? attendingIds.includes(currentUserId) : false,
      currentUserAttendanceStatus,
    }
  })
}

/** After attendance upsert: attendee uuid array for legacy column sync. */
export function attendeeIdsForLegacyColumn(
  eventId: string,
  rows: EventAttendanceRow[],
  existingIds: string[],
  userId: string,
  status: EventAttendanceStatus
): string[] {
  const eventRows = rows.filter((r) => r.event_id === eventId)
  const fromTable = eventRows
    .filter((r) => r.attendance_status === "attending")
    .map((r) => r.user_id)

  if (status === "attending") {
    return [...new Set([...fromTable, userId, ...existingIds.filter((id) => id === userId)])]
  }

  return fromTable.filter((id) => id !== userId)
}
