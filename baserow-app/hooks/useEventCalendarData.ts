"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchProfileLabelById } from "@/lib/users/profile-labels"
import {
  eventCalendarContentTypeOverride,
  eventCalendarOverridesFromConfig,
  isMarketingMockEnabled,
  resolveMarketingTable,
} from "@/lib/marketing/block-config-resolver"
import { applyMarketingBlockDataQuery } from "@/lib/marketing/block-data-query"
import {
  mergeAttendanceIntoEventItems,
  type EventAttendanceRow,
} from "@/lib/marketing/event-attendance"
import {
  buildEventItems,
  collectEventFilterOptions,
  isEventContentRecord,
  resolveContentEventFields,
  type ContentEventFieldMap,
  type EventAttendanceStatus,
  type EventTableIds,
  type MarketingEventItem,
} from "@/lib/marketing/events"
import { findContentTable, findQuarterlyThemesTable } from "@/lib/marketing/marketing-tables"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import type { BlockConfig } from "@/lib/interface/types"
import type { FieldOptions } from "@/types/fields"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

function mapFieldRow(row: { name: string; type?: string; options?: unknown }): FieldRow {
  return {
    name: row.name,
    type: row.type,
    options: row.options as FieldOptions | undefined,
  }
}

export interface UseEventCalendarDataResult {
  loading: boolean
  error: string | null
  fromLiveData: boolean
  hasTable: boolean
  tableIds: EventTableIds | null
  fields: ContentEventFieldMap | null
  allItems: MarketingEventItem[]
  filterOptions: ReturnType<typeof collectEventFilterOptions>
  currentUserId: string | null
  reload: () => void
  /** @deprecated Use upsertAttendance */
  updateAttendees: (eventId: string, attendeeIds: string[]) => Promise<void>
  upsertAttendance: (eventId: string, status: EventAttendanceStatus) => Promise<void>
  updateEventStatus: (eventId: string, statusValue: string) => Promise<void>
}

export function useEventCalendarData(options?: {
  config?: BlockConfig
}): UseEventCalendarDataResult {
  const config = options?.config
  const forceMock = isMarketingMockEnabled(config, "event_calendar_use_mock")
  const [loading, setLoading] = useState(!forceMock)
  const [error, setError] = useState<string | null>(null)
  const [fromLiveData, setFromLiveData] = useState(false)
  const [hasTable, setHasTable] = useState(false)
  const [tableIds, setTableIds] = useState<EventTableIds | null>(null)
  const [fields, setFields] = useState<ContentEventFieldMap | null>(null)
  const [allItems, setAllItems] = useState<MarketingEventItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  const syncLegacyAttendeeColumn = useCallback(
    async (eventId: string, attendeeIds: string[]) => {
      if (!tableIds?.contentSupabaseTable || !fields?.attendees) return
      const supabase = createClient()
      const { error: updateErr } = await supabase
        .from(tableIds.contentSupabaseTable)
        .update({ [fields.attendees]: attendeeIds })
        .eq("id", eventId)
      if (updateErr) throw new Error(updateErr.message)
    },
    [tableIds, fields]
  )

  const updateAttendees = useCallback(
    async (eventId: string, attendeeIds: string[]) => {
      await syncLegacyAttendeeColumn(eventId, attendeeIds)
      reload()
    },
    [syncLegacyAttendeeColumn, reload]
  )

  const upsertAttendance = useCallback(
    async (eventId: string, status: EventAttendanceStatus) => {
      if (!currentUserId) throw new Error("Sign in required")
      const supabase = createClient()

      const { error: upsertErr } = await supabase.from("event_attendance").upsert(
        {
          event_id: eventId,
          user_id: currentUserId,
          attendance_status: status,
        },
        { onConflict: "event_id,user_id" }
      )

      if (upsertErr) {
        if (status === "attending" && fields?.attendees) {
          const item = allItems.find((i) => i.id === eventId)
          const next = item?.currentUserAttending
            ? (item.attendeeIds.filter((id) => id !== currentUserId))
            : [...new Set([...(item?.attendeeIds || []), currentUserId])]
          await syncLegacyAttendeeColumn(eventId, next)
          reload()
          return
        }
        throw new Error(upsertErr.message)
      }

      if (fields?.attendees) {
        const item = allItems.find((i) => i.id === eventId)
        let next = [...(item?.attendeeIds || [])]
        if (status === "attending") {
          next = [...new Set([...next, currentUserId])]
        } else {
          next = next.filter((id) => id !== currentUserId)
        }
        await syncLegacyAttendeeColumn(eventId, next)
      }

      reload()
    },
    [currentUserId, fields, allItems, syncLegacyAttendeeColumn, reload]
  )

  const updateEventStatus = useCallback(
    async (eventId: string, statusValue: string) => {
      if (!tableIds?.contentSupabaseTable || !fields?.status) {
        throw new Error("Status field not configured")
      }
      const supabase = createClient()
      const { error: updateErr } = await supabase
        .from(tableIds.contentSupabaseTable)
        .update({ [fields.status]: statusValue })
        .eq("id", eventId)
      if (updateErr) throw new Error(updateErr.message)
      reload()
    },
    [tableIds, fields, reload]
  )

  useEffect(() => {
    if (forceMock) {
      setLoading(false)
      setError(null)
      setFromLiveData(false)
      setHasTable(false)
      setAllItems([])
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const userId = user?.id ?? null
        if (!cancelled) setCurrentUserId(userId)

        const { data: tables, error: tablesErr } = await supabase
          .from("tables")
          .select("id, name, supabase_table")

        if (tablesErr || !tables?.length) {
          throw new Error(tablesErr?.message || "Could not load tables")
        }

        const registry = tables as import("@/lib/marketing/marketing-tables").MarketingTableRow[]
        const contentTable = resolveMarketingTable(registry, config?.table_id, findContentTable)
        const locationsTable = tables.find((t) => /location/i.test(t.name))
        const themesTable = findQuarterlyThemesTable(registry)

        if (!contentTable?.supabase_table) {
          setHasTable(false)
          throw new Error("Content table not found — select a source table in block settings")
        }
        setHasTable(true)

        const ids: EventTableIds = {
          contentTableId: contentTable.id,
          contentSupabaseTable: contentTable.supabase_table,
          eventsTableId: contentTable.id,
          eventsSupabaseTable: contentTable.supabase_table,
          locationsTableId: locationsTable?.id ?? null,
          locationsSupabaseTable: locationsTable?.supabase_table ?? null,
          themesTableId: themesTable?.id ?? null,
          themesSupabaseTable: themesTable?.supabase_table ?? null,
        }

        const tableIdList = [contentTable.id, locationsTable?.id, themesTable?.id].filter(
          Boolean
        ) as string[]

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("name, type, options, table_id")
          .in("table_id", tableIdList)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const contentFieldRows = (fieldRows || [])
          .filter((f) => f.table_id === contentTable.id)
          .map(mapFieldRow)
        const resolved = resolveContentEventFields(
          contentFieldRows,
          eventCalendarOverridesFromConfig(config),
          eventCalendarContentTypeOverride(config)
        )

        let contentQuery = supabase.from(contentTable.supabase_table).select("*")
        if (resolved.deletedAt) {
          contentQuery = contentQuery.is(resolved.deletedAt, null)
        }
        const { data: contentRows, error: contentErr } = await applyMarketingBlockDataQuery(
          contentQuery,
          config,
          (fieldRows || [])
            .filter((f) => f.table_id === contentTable.id)
            .map((f) => ({ id: undefined, name: f.name, type: f.type, options: f.options }))
        )
        if (contentErr) throw new Error(contentErr.message)

        const sourceLooksLikeDedicatedEventsTable = /event/i.test(String(contentTable.name || ""))
        const shouldFilterByContentType =
          !sourceLooksLikeDedicatedEventsTable && !!resolved.contentType
        const eventRows = shouldFilterByContentType
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
          const themeFields = (fieldRows || [])
            .filter((f) => f.table_id === themesTable.id)
            .map(mapFieldRow)
          const themeNameField = themeFields.find((f) => /name/i.test(f.name))?.name ?? "name"
          const { data: themeRows } = await supabase.from(themesTable.supabase_table).select("*")
          for (const row of themeRows || []) {
            const label = formatDisplayValue(row[themeNameField])
            if (label) themeLabelById.set(String(row.id), label)
          }
        }

        const profileLabelById = await fetchProfileLabelById(supabase)

        let items = buildEventItems({
          rows: eventRows as Record<string, unknown>[],
          fields: resolved,
          locationById,
          themeLabelById,
          profileLabelById,
          currentUserId: userId,
          contentTypeField: resolved.contentType,
          filterContentEvents: false,
        })

        const eventIds = items.map((i) => i.id)
        if (eventIds.length > 0) {
          const { data: attendanceRows, error: attErr } = await supabase
            .from("event_attendance")
            .select("event_id, user_id, attendance_status")
            .in("event_id", eventIds)

          if (!attErr && attendanceRows?.length) {
            items = mergeAttendanceIntoEventItems(
              items,
              attendanceRows as EventAttendanceRow[],
              userId,
              profileLabelById
            )
          }
        }

        if (cancelled) return
        setTableIds(ids)
        setFields(resolved)
        setAllItems(items)
        setFromLiveData(true)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load events")
          setAllItems([])
          setFromLiveData(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadToken, config, forceMock])

  const filterOptions = useMemo(() => collectEventFilterOptions(allItems), [allItems])

  return {
    loading,
    error,
    fromLiveData,
    hasTable,
    tableIds,
    fields,
    allItems,
    filterOptions,
    currentUserId,
    reload,
    updateAttendees,
    upsertAttendance,
    updateEventStatus,
  }
}
