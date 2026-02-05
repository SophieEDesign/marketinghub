"use client"

/**
 * Record editor core — shared logic for load/save/delete and field normalization.
 * No UI; shells (RecordModal, RecordPanel, RecordDrawer) delegate to this and keep their UI.
 * Additive only; existing shells keep their props and behaviour.
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAbortError } from '@/lib/api/error-handling'
import type { TableField } from '@/types/fields'

export interface RecordEditorCoreOptions {
  tableId: string
  recordId: string | null
  /** When provided, skips fetching table info */
  supabaseTableName?: string | null
  /** When provided, skips fetching fields from API */
  tableFields?: TableField[] | null
  /** Restrict which fields to show (empty = all) */
  modalFields?: string[]
  /** For create mode: initial form values */
  initialData?: Record<string, any>
  /** Only load when true (e.g. modal open) */
  active?: boolean
  onSave?: (createdRecordId?: string | null) => void
  onDeleted?: () => void | Promise<void>
}

export interface RecordEditorCoreResult {
  loading: boolean
  formData: Record<string, any>
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>
  fields: TableField[]
  effectiveTableName: string | null
  saving: boolean
  deleting: boolean
  isCreateMode: boolean
  save: () => Promise<void>
  deleteRecord: (options?: { confirmMessage?: string }) => Promise<void>
  handleFieldChange: (fieldName: string, value: any) => void
  /** Normalize value for link_to_table before save/update (shared with grid modal behaviour) */
  normalizeUpdateValue: (fieldName: string, value: any) => any
}

function normalizeLinkValue(
  value: any,
  field: TableField
): any {
  const v: any = value === undefined ? null : value
  const toId = (x: any): string | null => {
    if (x == null || x === '') return null
    if (typeof x === 'string') return x
    if (typeof x === 'object' && x && 'id' in x) return String((x as any).id)
    return String(x)
  }
  const relationshipType = (field.options as any)?.relationship_type as
    | 'one-to-one'
    | 'one-to-many'
    | 'many-to-many'
    | undefined
  const maxSelections = (field.options as any)?.max_selections as number | undefined
  const isMulti =
    relationshipType === 'one-to-many' ||
    relationshipType === 'many-to-many' ||
    (typeof maxSelections === 'number' && maxSelections > 1)

  if (isMulti) {
    if (v == null) return null
    if (Array.isArray(v)) return v.map(toId).filter(Boolean)
    const id = toId(v)
    return id ? [id] : null
  }
  if (Array.isArray(v)) return toId(v[0])
  return toId(v)
}

export function useRecordEditorCore(
  options: RecordEditorCoreOptions
): RecordEditorCoreResult {
  const {
    tableId,
    recordId,
    supabaseTableName: supabaseTableNameProp,
    tableFields: tableFieldsProp,
    modalFields = [],
    initialData,
    active = true,
    onSave,
    onDeleted,
  } = options

  const [effectiveTableName, setEffectiveTableName] = useState<string | null>(
    supabaseTableNameProp ?? null
  )
  const [fields, setFields] = useState<TableField[]>(tableFieldsProp ?? [])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isCreateMode = recordId == null

  const loadTableInfo = useCallback(async () => {
    if (!tableId || supabaseTableNameProp != null) return
    try {
      const supabase = createClient()
      const sanitized = tableId.split(':')[0]
      const { data, error } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', sanitized)
        .single()
      if (!error && data?.supabase_table) {
        setEffectiveTableName(data.supabase_table)
      }
    } catch (e) {
      if (!isAbortError(e)) console.error('Error loading table info:', e)
    }
  }, [tableId, supabaseTableNameProp])

  const loadFields = useCallback(async () => {
    if (tableFieldsProp != null || !tableId) return
    try {
      const res = await fetch(`/api/tables/${tableId}/fields`)
      const data = await res.json()
      if (data?.fields) {
        setFields(data.fields)
      }
    } catch (e) {
      if (!isAbortError(e)) console.error('Error loading fields:', e)
    }
  }, [tableId, tableFieldsProp])

  const loadRecord = useCallback(async () => {
    if (recordId == null || !effectiveTableName) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(effectiveTableName)
        .select('*')
        .eq('id', recordId)
        .single()
      if (!error && data) {
        setFormData(data)
      }
    } catch (e) {
      if (!isAbortError(e)) console.error('Error loading record:', e)
    } finally {
      setLoading(false)
    }
  }, [recordId, effectiveTableName])

  useEffect(() => {
    if (supabaseTableNameProp != null) {
      setEffectiveTableName(supabaseTableNameProp)
    }
  }, [supabaseTableNameProp])

  useEffect(() => {
    if (tableFieldsProp != null) {
      setFields(tableFieldsProp)
    }
  }, [tableFieldsProp])

  useEffect(() => {
    if (!active) return
    if (tableId && supabaseTableNameProp == null) {
      loadTableInfo()
    }
  }, [active, tableId, supabaseTableNameProp, loadTableInfo])

  useEffect(() => {
    if (!active) return
    if (tableId && tableFieldsProp == null) {
      loadFields()
    }
  }, [active, tableId, tableFieldsProp, loadFields])

  useEffect(() => {
    if (!active || !effectiveTableName) return
    if (recordId) {
      loadRecord()
    } else if (initialData) {
      setFormData(initialData)
    } else {
      setFormData({})
    }
  }, [active, recordId, effectiveTableName, initialData, loadRecord])

  const filteredFields = modalFields.length > 0
    ? fields.filter(
        (f) => f && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at' &&
          (modalFields.includes(f.name) || modalFields.includes(f.id))
      )
    : fields.filter(
        (f) => f && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at'
      )

  const normalizeUpdateValue = useCallback(
    (fieldName: string, value: any): any => {
      const v: any = value === undefined ? null : value
      const field = fields.find((f) => f?.name === fieldName)
      if (!field || field.type !== 'link_to_table') return v
      return normalizeLinkValue(value, field)
    },
    [fields]
  )

  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
  }, [])

  const save = useCallback(async () => {
    if (!effectiveTableName) return
    setSaving(true)
    try {
      const supabase = createClient()
      // Build payload: full formData with link fields normalized (mirror calendar modal behaviour)
      const payload = { ...formData }
      for (const f of filteredFields) {
        if (f.type === 'link_to_table') {
          payload[f.name] = normalizeUpdateValue(f.name, formData[f.name])
        }
      }
      if (recordId) {
        const { error } = await supabase
          .from(effectiveTableName)
          .update(payload)
          .eq('id', recordId)
        if (error) throw error
        onSave?.()
      } else {
        const { data, error } = await supabase
          .from(effectiveTableName)
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        const createdId = data?.id ?? null
        onSave?.(createdId)
      }
    } catch (e) {
      if (!isAbortError(e)) throw e
    } finally {
      setSaving(false)
    }
  }, [
    effectiveTableName,
    recordId,
    formData,
    filteredFields,
    normalizeUpdateValue,
    onSave,
  ])

  const deleteRecord = useCallback(
    async (opts?: { confirmMessage?: string }) => {
      if (!recordId || !effectiveTableName) return
      const msg = opts?.confirmMessage ?? 'Are you sure you want to delete this record? This action cannot be undone.'
      if (!confirm(msg)) return
      setDeleting(true)
      try {
        const supabase = createClient()
        const { error } = await supabase.from(effectiveTableName).delete().eq('id', recordId)
        if (error) throw error
        await onDeleted?.()
      } catch (e) {
        if (!isAbortError(e)) throw e
      } finally {
        setDeleting(false)
      }
    },
    [recordId, effectiveTableName, onDeleted]
  )

  return {
    loading,
    formData,
    setFormData,
    fields: filteredFields,
    effectiveTableName,
    saving,
    deleting,
    isCreateMode,
    save,
    deleteRecord,
    handleFieldChange,
    normalizeUpdateValue,
  }
}
