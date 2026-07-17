/**
 * Server-side event calendar data loading (feed API).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  eventCalendarContentTypeOverride,
  eventCalendarOverridesFromConfig,
} from "@/lib/marketing/event-calendar-config"
import { filterEventsByAudience } from "@/lib/marketing/event-calendar-visibility"
import {
  mergeAttendanceIntoEventItems,
  type EventAttendanceRow,
} from "@/lib/marketing/event-attendance"
import {
  buildEventItems,
  filterEventItems,
  isEventContentRecord,
  resolveContentEventFields,
  type EventCalendarFilters,
  type MarketingEventItem,
} from "@/lib/marketing/events"
import { findContentTable, findQuarterlyThemesTable } from "@/lib/marketing/marketing-tables"
import { resolveMarketingTable } from "@/lib/marketing/block-config-resolver"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import type { BlockConfig } from "@/lib/interface/types"

export async function loadEventCalendarItemsServer(params: {
  supabase: SupabaseClient
  config: BlockConfig
  currentUserId: string | null
  externalMode: boolean
  isAdminView: boolean
  scope: "all" | "attending"
}): Promise<MarketingEventItem[]> {
  const { supabase, config, currentUserId, externalMode, isAdminView, scope } = params

  const { data: tables } = await supabase.from("tables").select("id, name, supabase_table")
  if (!tables?.length) return []

  const registry = tables as import("@/lib/marketing/marketing-tables").MarketingTableRow[]
  const contentTable = resolveMarketingTable(registry, config.table_id, findContentTable)
  if (!contentTable?.supabase_table) return []

  const locationsTable = tables.find((t) => /location/i.test(t.name))
  const themesTable = findQuarterlyThemesTable(registry)

  const { data: fieldRows } = await supabase
    .from("table_fields")
    .select("name, type, options, table_id")
    .in(
      "table_id",
      [contentTable.id, locationsTable?.id, themesTable?.id].filter(Boolean) as string[]
    )

  const contentFieldRows = (fieldRows || [])
    .filter((f) => f.table_id === contentTable.id)
    .map((f) => ({
      name: f.name,
      type: f.type,
      options: f.options,
    }))

  const resolved = resolveContentEventFields(
    contentFieldRows,
    eventCalendarOverridesFromConfig(config),
    eventCalendarContentTypeOverride(config)
  )

  let query = supabase.from(contentTable.supabase_table).select("*")
  if (resolved.deletedAt) {
    query = query.is(resolved.deletedAt, null)
  }
  const { data: contentRows } = await query

  const dedicated = /event/i.test(String(contentTable.name || ""))
  const eventRows =
    !dedicated && resolved.contentType
      ? (contentRows || []).filter((row: Record<string, unknown>) =>
          isEventContentRecord(row, resolved.contentType)
        )
      : contentRows || []

  const locationById = new Map<string, Record<string, unknown>>()
  if (locationsTable?.supabase_table) {
    const { data: locRows } = await supabase.from(locationsTable.supabase_table).select("*")
    for (const row of locRows || []) {
      locationById.set(String(row.id), row as Record<string, unknown>)
    }
  }

  const themeLabelById = new Map<string, string>()
  if (themesTable?.supabase_table) {
    const themeNameField =
      (fieldRows || [])
        .filter((f) => f.table_id === themesTable.id)
        .find((f) => /name/i.test(f.name))?.name ?? "name"
    const { data: themeRows } = await supabase.from(themesTable.supabase_table).select("*")
    for (const row of themeRows || []) {
      const label = formatDisplayValue(row[themeNameField])
      if (label) themeLabelById.set(String(row.id), label)
    }
  }

  let items = buildEventItems({
    rows: eventRows as Record<string, unknown>[],
    fields: resolved,
    locationById,
    themeLabelById,
    profileLabelById: new Map(),
    currentUserId,
    filterContentEvents: false,
  })

  const eventIds = items.map((i) => i.id)
  if (eventIds.length > 0) {
    const { data: attendanceRows } = await supabase
      .from("event_attendance")
      .select("event_id, user_id, attendance_status")
      .in("event_id", eventIds)
    if (attendanceRows?.length) {
      items = mergeAttendanceIntoEventItems(
        items,
        attendanceRows as EventAttendanceRow[],
        currentUserId
      )
    }
  }

  items = filterEventsByAudience(items, { externalMode, isAdminView })

  const emptyFilters: EventCalendarFilters = {
    search: "",
    eventTypes: [],
    locations: [],
    statuses: [],
    owners: [],
    attendeeFilter: "all",
  }
  items = filterEventItems(items, emptyFilters, currentUserId)

  if (scope === "attending" && currentUserId) {
    items = items.filter(
      (i) =>
        i.currentUserAttendanceStatus === "attending" ||
        i.attendeeIds.includes(currentUserId)
    )
  }

  const max =
    typeof config.event_calendar_max_items === "number"
      ? config.event_calendar_max_items
      : undefined
  if (max != null && max > 0) {
    items = items.slice(0, max)
  }

  return items
}
