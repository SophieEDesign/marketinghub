"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  buildStaffHubAssets,
  collectFilterOptions,
  resolveInternalStaffFields,
  type InternalStaffFieldMap,
  type InternalStaffTableIds,
  type StaffHubAsset,
} from "@/lib/marketing/internal-staff-hub"
import type { FieldOptions } from "@/types/fields"

type FieldRow = { name: string; type?: string; options?: FieldOptions }

interface UseInternalStaffHubDataResult {
  loading: boolean
  error: string | null
  tableIds: InternalStaffTableIds | null
  fields: InternalStaffFieldMap | null
  assets: StaffHubAsset[]
  filterOptions: ReturnType<typeof collectFilterOptions>
  reload: () => void
}

export function useInternalStaffHubData(): UseInternalStaffHubDataResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableIds, setTableIds] = useState<InternalStaffTableIds | null>(null)
  const [fields, setFields] = useState<InternalStaffFieldMap | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data: tables, error: tablesErr } = await supabase
          .from("tables")
          .select("id, name, supabase_table")

        if (tablesErr || !tables?.length) {
          throw new Error(tablesErr?.message || "Could not load tables")
        }

        const resources = tables.find((t) =>
          /resource|document|asset|file|library/i.test(String(t.name))
        )
        const content = tables.find(
          (t) =>
            /^content$/i.test(String(t.name).trim()) ||
            (/content/i.test(t.name) && !/calendar/i.test(t.name) && !/briefing/i.test(t.name))
        )
        const target = resources ?? content
        if (!target?.supabase_table) {
          throw new Error("Resources or Content table not found")
        }

        const ids: InternalStaffTableIds = {
          resourcesTableId: target.id,
          resourcesSupabaseTable: target.supabase_table,
        }

        const { data: fieldRows, error: fieldsErr } = await supabase
          .from("table_fields")
          .select("id, table_id, name, type, options")
          .eq("table_id", target.id)

        if (fieldsErr) throw new Error(fieldsErr.message)

        const fieldMap = resolveInternalStaffFields((fieldRows || []) as FieldRow[])

        let query = supabase.from(target.supabase_table).select("*")
        if (fieldMap.deletedAt) {
          query = query.is(fieldMap.deletedAt, null)
        }
        const { data: resourceRows, error: rowsErr } = await query.order("created_at", {
          ascending: false,
        })

        if (rowsErr) throw new Error(rowsErr.message)

        if (!cancelled) {
          setTableIds(ids)
          setFields(fieldMap)
          setRows(resourceRows || [])
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load resources")
          setTableIds(null)
          setFields(null)
          setRows([])
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

  const assets = useMemo(() => {
    if (!fields) return []
    return buildStaffHubAssets(rows, fields)
  }, [rows, fields])

  const filterOptions = useMemo(() => collectFilterOptions(assets), [assets])

  return { loading, error, tableIds, fields, assets, filterOptions, reload }
}
