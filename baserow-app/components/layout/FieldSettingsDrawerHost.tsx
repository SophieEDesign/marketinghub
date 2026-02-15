"use client"

import { useEffect, useState } from "react"
import { useFieldSettings } from "@/contexts/FieldSettingsContext"
import { useSelectionContext } from "@/contexts/SelectionContext"
import FieldSettingsDrawer from "./FieldSettingsDrawer"
import type { TableField } from "@/types/fields"
import type { SectionSettings } from "@/lib/core-data/types"
import { getTableSections } from "@/lib/core-data/section-settings"

/**
 * Host component that renders FieldSettingsDrawer when FieldSettingsContext has a selected field.
 * Mounted once in WorkspaceShell; fetches field + tableFields when opened.
 */
export default function FieldSettingsDrawerHost() {
  const { state, closeFieldSettings } = useFieldSettings()
  const { selectedContext, setSelectedContext } = useSelectionContext()
  const [field, setField] = useState<TableField | null>(null)
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [sections, setSections] = useState<SectionSettings[]>([])
  const [loading, setLoading] = useState(false)

  // Context-driven: prefer SelectionContext when type is 'field'
  const fieldFromSelection = selectedContext?.type === "field" ? selectedContext : null
  const effectiveFieldId = fieldFromSelection?.fieldId ?? state.fieldId
  const effectiveTableId = fieldFromSelection?.tableId ?? state.tableId
  const open = Boolean(effectiveFieldId && effectiveTableId)

  useEffect(() => {
    const tableId = effectiveTableId
    if (!effectiveFieldId || !tableId) {
      setField(null)
      setTableFields([])
      setSections([])
      return
    }

    const tableIdStr: string = tableId
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const [fieldsRes, sectionsData] = await Promise.all([
          fetch(`/api/tables/${tableIdStr}/fields`, { cache: "no-store" }),
          getTableSections(tableIdStr).catch(() => []),
        ])

        if (cancelled) return

        const fieldsJson = await fieldsRes.json()
        const fields: TableField[] = fieldsJson?.fields ?? []
        const found = fields.find((f: TableField) => f.id === effectiveFieldId)

        if (cancelled) return

        setField(found ?? null)
        setTableFields(fields)
        setSections(sectionsData)
      } catch (err) {
        console.error("[FieldSettingsDrawerHost] Failed to load field:", err)
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
  }, [effectiveFieldId, effectiveTableId])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (fieldFromSelection) setSelectedContext(null)
      else closeFieldSettings()
    }
  }

  const handleSave = () => {
    if (fieldFromSelection) setSelectedContext(null)
    else closeFieldSettings()
    // Schema edits are global; parent components may refetch via their own data flow
  }

  if (!open || !effectiveTableId) return null

  return (
    <FieldSettingsDrawer
      field={loading ? null : field}
      open={open}
      onOpenChange={handleOpenChange}
      tableId={effectiveTableId}
      tableFields={tableFields}
      sections={sections}
      onSave={handleSave}
      overlayMode
      permissionsReadOnly={state.readOnly}
    />
  )
}
