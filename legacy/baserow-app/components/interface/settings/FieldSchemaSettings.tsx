"use client"

import { useEffect, useState } from "react"
import FieldSettingsDrawer from "@/components/layout/FieldSettingsDrawer"
import type { TableField } from "@/types/fields"
import { getTableSections } from "@/lib/core-data/section-settings"
import type { SectionSettings } from "@/lib/core-data/types"

interface FieldSchemaSettingsProps {
  fieldId: string
  tableId: string
}

export default function FieldSchemaSettings({
  fieldId,
  tableId,
}: FieldSchemaSettingsProps) {
  const [field, setField] = useState<TableField | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [sections, setSections] = useState<SectionSettings[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!fieldId || !tableId) {
      setField(null)
      setTableFields([])
      setSections([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const [fieldsRes, sectionsData] = await Promise.all([
          fetch(`/api/tables/${tableId}/fields`, { cache: "no-store" }),
          getTableSections(tableId).catch(() => []),
        ])

        if (cancelled) return

        const fieldsJson = await fieldsRes.json()
        const fields: TableField[] = fieldsJson?.fields ?? []
        const found = fields.find((f: TableField) => f.id === fieldId)

        if (cancelled) return

        setField(found ?? null)
        setTableFields(fields)
        setSections(sectionsData)
      } catch (err) {
        console.error("[FieldSchemaSettings] Failed to load field:", err)
        if (!cancelled) {
          setField(null)
          setTableFields([])
          setSections([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [fieldId, tableId])

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-sm text-gray-500">Loading field...</div>
      </div>
    )
  }

  if (!field) {
    return (
      <div className="p-4">
        <div className="text-sm text-gray-500">Field not found</div>
      </div>
    )
  }

  return (
    <FieldSettingsDrawer
      field={field}
      open={true}
      onOpenChange={() => {}}
      tableId={tableId}
      tableFields={tableFields}
      sections={sections}
      onSave={() => {}}
      embedded
    />
  )
}
