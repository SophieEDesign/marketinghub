"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  buildEventItems,
  collectEventFilterOptions,
  isEventContentRecord,
  resolveContentEventFields,
  type ContentEventFieldMap,
  type EventTableIds,
  type MarketingEventItem,
} from "@/lib/marketing/events"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
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
  tableIds: EventTableIds | null
  fields: ContentEventFieldMap | null
  allItems: MarketingEventItem[]
  filterOptions: ReturnType<typeof collectEventFilterOptions>
  currentUserId: string | null
  reload: () => void
  updateAttendees: (eventId: string, attendeeIds: string[]) => Promise<void>
}

export function useEventCalendarData(): UseEventCalendarDataResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableIds, setTableIds] = useState<EventTableIds | null>(null)
  const [fields, setFields] = useState<ContentEventFieldMap | null>(null)
  const [allItems, setAllItems] = useState<MarketingEventItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  const updateAttendees = useCallback(
    async (eventId: string, attendeeIds: string[]) => {
      if (!tableIds?.contentSupabaseTable || !fields) return
      const col = fields.attendees || "attendee_user_ids"
      const supabase = createClient()
      const { error: updateErr } = await supabase
        .from(tableIds.contentSupabaseTable)
        .update({ [col]: attendeeIds })
        .eq("id", eventId)
      if (updateErr) throw new Error(updateErr.message)
      reload()
    },
    [tableIds, fields, reload]
  )

  useEffect(() => {
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

        const contentTable = tables.find(
          (t) =>
            /^content$/i.test(String(t.name).trim()) ||
            (/content/i.test(t.name) &&
              !/calendar/i.test(t.name) &&
              !/briefing/i.test(t.name))
        )
        const locationsTable = tables.find((t) => /location/i.test(t.name))
        const themesTable = tables.find(
          (t) => /quarterly/i.test(t.name) && /theme/i.test(t.name)
        )

        if (!contentTable?.supabase_table) {
          throw new Error("Content table not found")
        }

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

        const tableIdList = [
          contentTable.id,
          locationsTable?.id,
          themesTable?.id,
        ].filter(Boolean) as string[]

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("name, type, options, table_id")
          .in("table_id", tableIdList)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const contentFieldRows = (fieldRows || [])
          .filter((f) => f.table_id === contentTable.id)
          .map(mapFieldRow)
        const resolved = resolveContentEventFields(contentFieldRows)

        if (process.env.NODE_ENV === "development" && !resolved.contentType) {
          console.warn(
            "[EventCalendar] No content type field resolved — filtering with common field names"
          )
        }
        if (process.env.NODE_ENV === "development" && !resolved.startDate) {
          console.warn("[EventCalendar] No start date field resolved on Content table")
        }

        let contentQuery = supabase.from(contentTable.supabase_table).select("*")
        if (resolved.deletedAt) {
          contentQuery = contentQuery.is(resolved.deletedAt, null)
        }
        const { data: contentRows, error: contentErr } = await contentQuery
        if (contentErr) throw new Error(contentErr.message)

        const eventRows = (contentRows || []).filter((row) =>
          isEventContentRecord(row as Record<string, unknown>, resolved.contentType)
        )

        const locationById = new Map<string, Record<string, unknown>>()
        if (locationsTable?.supabase_table) {
          const { data: locRows } = await supabase
            .from(locationsTable.supabase_table)
            .select("*")
          for (const row of locRows || []) {
            locationById.set(String(row.id), row as Record<string, unknown>)
          }
        }

        const themeLabelById = new Map<string, string>()
        if (themesTable?.supabase_table) {
          const themeFields = (fieldRows || [])
            .filter((f) => f.table_id === themesTable.id)
            .map(mapFieldRow)
          const themeNameField =
            themeFields.find((f) => /name/i.test(f.name))?.name ?? "name"
          const { data: themeRows } = await supabase
            .from(themesTable.supabase_table)
            .select("*")
          for (const row of themeRows || []) {
            const label = formatDisplayValue(row[themeNameField])
            if (label) themeLabelById.set(String(row.id), label)
          }
        }

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")

        const profileLabelById = new Map<string, string>()
        for (const p of profiles || []) {
          const label =
            formatDisplayValue(p.full_name) ||
            formatDisplayValue(p.email) ||
            String(p.id).slice(0, 8)
          profileLabelById.set(String(p.id), label)
        }

        const items = buildEventItems({
          rows: eventRows as Record<string, unknown>[],
          fields: resolved,
          locationById,
          themeLabelById,
          profileLabelById,
          currentUserId: userId,
          contentTypeField: resolved.contentType,
          filterContentEvents: false,
        })

        if (cancelled) return
        setTableIds(ids)
        setFields(resolved)
        setAllItems(items)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load events")
          setAllItems([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const filterOptions = useMemo(() => collectEventFilterOptions(allItems), [allItems])

  return {
    loading,
    error,
    tableIds,
    fields,
    allItems,
    filterOptions,
    currentUserId,
    reload,
    updateAttendees,
  }
}
