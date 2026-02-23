"use client"

/**
 * Record editor core — shared logic for load/save/delete and field normalization.
 * No UI; shells (RecordModal, RecordPanel, RecordDrawer) delegate to this and keep their UI.
 * Additive only; existing shells keep their props and behaviour.
 *
 * PERMISSION ENFORCEMENT INVARIANT (see docs/PERMISSION_ENFORCEMENT_INVARIANT.md):
 * - When cascadeContext is provided, record mutation is governed exclusively by canEditRecords,
 *   canCreateRecords, and canDeleteRecords, enforced in both UI and core (save/delete below).
 * - When cascadeContext is not provided, core-data behaviour remains unchanged (no gating).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAbortError } from '@/lib/api/error-handling'
import { useToast } from '@/components/ui/use-toast'
import { syncLinkedFieldBidirectional } from '@/lib/dataView/linkedFields'
import type { TableField } from '@/types/fields'
import type { PageConfig } from '@/lib/interface/page-config'
import type { BlockConfig } from '@/lib/interface/types'
import { useUserRole } from '@/lib/hooks/useUserRole'
import {
  canEditRecords as cascadeCanEditRecords,
  canCreateRecord as cascadeCanCreateRecord,
  canDeleteRecord as cascadeCanDeleteRecord,
} from '@/lib/interface/permission-cascade'
import { triggerRecordAutomations } from '@/lib/automations/trigger-record-client'
import type { FieldLayoutItem } from '@/lib/interface/field-layout-utils'
import {
  getVisibleFieldsFromLayout,
  convertModalLayoutToFieldLayout,
  convertModalFieldsToFieldLayout,
} from '@/lib/interface/field-layout-helpers'

/** Optional context for permission cascade (read-only; core does not enforce). */
export interface RecordEditorCascadeContext {
  pageConfig?: PageConfig | null
  blockConfig?: BlockConfig | null
}

export interface RecordEditorCoreOptions {
  tableId: string
  recordId: string | null
  /** When provided, skips fetching table info */
  supabaseTableName?: string | null
  /** When provided, skips fetching fields from API */
  tableFields?: TableField[] | null
  /** Restrict which fields to show (empty = all). @deprecated Use fieldLayout instead. */
  modalFields?: string[]
  /** Unified field layout; when provided, fields are derived from getVisibleFieldsFromLayout(fieldLayout, tableFields, 'modal'). Preferred over modalFields. */
  fieldLayout?: FieldLayoutItem[] | null
  /** @deprecated Use fieldLayout. Backward compat: custom modal layout blocks. */
  modalLayout?: { blocks?: Array<{ fieldName?: string; y?: number; config?: any }> } | null
  /** Visibility context for field_layout: 'modal' or 'canvas'. Default 'modal'. */
  visibilityContext?: "modal" | "canvas"
  /** For create mode: initial form values */
  initialData?: Record<string, any>
  /** Only load when true (e.g. modal open) */
  active?: boolean
  onSave?: (createdRecordId?: string | null) => void
  onDeleted?: () => void | Promise<void>
  /** Optional: permission cascade context; when provided, core enforces canEdit/canCreate/canDelete in save() and deleteRecord(). */
  cascadeContext?: RecordEditorCascadeContext | null
  /** When true (default), persist each field change immediately (Airtable-style). Only applies when recordId exists (edit mode). */
  saveOnFieldChange?: boolean
}

export interface RecordEditorCoreResult {
  loading: boolean
  formData: Record<string, any>
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>
  fields: TableField[]
  /** All table fields (before layout filter); for backward-compat conversion of modalLayout/modalFields. */
  allFields: TableField[]
  /** Resolved field layout passed to options; for shells to pass to RecordFields. */
  fieldLayout: FieldLayoutItem[] | null | undefined
  effectiveTableName: string | null
  saving: boolean
  deleting: boolean
  isCreateMode: boolean
  save: () => Promise<void>
  deleteRecord: (options?: { confirmMessage?: string; skipConfirm?: boolean }) => Promise<void>
  handleFieldChange: (fieldName: string, value: any) => void
  /** Normalize value for link_to_table before save/update (shared with grid modal behaviour) */
  normalizeUpdateValue: (fieldName: string, value: any) => any
  /** Permission cascade; when cascadeContext was provided, shells must enforce these in UI and core gates save/delete. */
  canEditRecords: boolean
  canDeleteRecords: boolean
  canCreateRecords: boolean
  /** When true, field changes are persisted immediately (edit mode); Save button can be hidden. */
  saveOnFieldChange: boolean
  /** True when formData differs from last loaded/saved state */
  isDirty: boolean
  /** True when a localStorage draft exists that is newer than DB (edit) or exists (create) */
  hasDraftToRestore: boolean
  /** Restore draft from localStorage into formData */
  restoreDraft: () => void
  /** Clear draft from localStorage (call after save or discard) */
  clearDraft: () => void
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
    fieldLayout: fieldLayoutProp,
    modalLayout: modalLayoutProp,
    visibilityContext: visibilityContextProp = "modal",
    initialData,
    active = true,
    onSave,
    onDeleted,
    cascadeContext,
    saveOnFieldChange = true,
  } = options

  const { role: userRole } = useUserRole()
  const { toast } = useToast()

  const cascadeContextForHelpers = useMemo(
    () => (cascadeContext?.blockConfig != null ? { blockConfig: cascadeContext.blockConfig } : undefined),
    [cascadeContext?.blockConfig]
  )

  const canEditRecords = useMemo(
    () => cascadeCanEditRecords(cascadeContextForHelpers),
    [cascadeContextForHelpers]
  )
  const canCreateRecords = useMemo(
    () => cascadeCanCreateRecord(userRole, cascadeContext?.pageConfig, cascadeContextForHelpers),
    [userRole, cascadeContext?.pageConfig, cascadeContextForHelpers]
  )
  const canDeleteRecords = useMemo(
    () => cascadeCanDeleteRecord(userRole, cascadeContext?.pageConfig, cascadeContextForHelpers),
    [userRole, cascadeContext?.pageConfig, cascadeContextForHelpers]
  )

  const [effectiveTableName, setEffectiveTableName] = useState<string | null>(
    supabaseTableNameProp ?? null
  )
  const [fields, setFields] = useState<TableField[]>(tableFieldsProp ?? [])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false)
  const [baselineFormData, setBaselineFormData] = useState<Record<string, any>>({})

  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const formDataRef = useRef<Record<string, any>>({})
  const baselineFormDataRef = useRef<Record<string, any>>({})
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCreateMode = recordId == null

  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach((t) => clearTimeout(t))
      debounceTimersRef.current.clear()
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current)
        draftSaveTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || loading) return
    if (Object.keys(formData).length === 0 && !recordId) return
    draftSaveTimeoutRef.current = setTimeout(() => {
      draftSaveTimeoutRef.current = null
      try {
        const key = getDraftKey()
        localStorage.setItem(key, JSON.stringify({
          formData: { ...formData },
          savedAt: Date.now(),
        }))
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.warn('Failed to save draft:', e)
      }
    }, 500)
    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current)
        draftSaveTimeoutRef.current = null
      }
    }
  }, [formData, loading, recordId, getDraftKey])

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

  const getDraftKey = useCallback(() => {
    if (recordId) return `record-draft-${recordId}`
    return `record-draft-new-${tableId}`
  }, [recordId, tableId])

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(getDraftKey())
      setHasDraftToRestore(false)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.warn('Failed to clear draft:', e)
    }
  }, [getDraftKey])

  const loadRecord = useCallback(async () => {
    const tableToUse = supabaseTableNameProp ?? effectiveTableName
    if (recordId == null || !tableToUse) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from(tableToUse)
        .select('*')
        .eq('id', recordId)
        .is('deleted_at', null)
        .single()
      if (!error && data) {
        setFormData(data)
        const baseline = { ...data }
        baselineFormDataRef.current = baseline
        setBaselineFormData(baseline)
        if (typeof window !== 'undefined') {
          try {
            const draftRaw = localStorage.getItem(getDraftKey())
            if (draftRaw) {
              const draft = JSON.parse(draftRaw) as { formData: Record<string, any>; savedAt: number }
              const recordUpdatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0
              if (draft.savedAt > recordUpdatedAt) {
                setHasDraftToRestore(true)
              } else {
                localStorage.removeItem(getDraftKey())
              }
            } else {
              setHasDraftToRestore(false)
            }
          } catch {
            setHasDraftToRestore(false)
          }
        }
      }
    } catch (e) {
      if (!isAbortError(e)) console.error('Error loading record:', e)
    } finally {
      setLoading(false)
    }
  }, [recordId, effectiveTableName, supabaseTableNameProp, getDraftKey])

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
    if (!active) return
    if (recordId) {
      const tableToUse = supabaseTableNameProp ?? effectiveTableName
      if (tableToUse) {
        loadRecord()
      } else {
        setLoading(false)
      }
    } else if (initialData) {
      setFormData(initialData)
      const baseline = { ...initialData }
      baselineFormDataRef.current = baseline
      setBaselineFormData(baseline)
      if (typeof window !== 'undefined') {
        try {
          const draftRaw = localStorage.getItem(getDraftKey())
          setHasDraftToRestore(!!draftRaw)
        } catch {
          setHasDraftToRestore(false)
        }
      }
    } else {
      setFormData({})
      baselineFormDataRef.current = {}
      setBaselineFormData({})
      setHasDraftToRestore(false)
    }
  }, [active, recordId, effectiveTableName, supabaseTableNameProp, initialData, loadRecord, getDraftKey])

  const effectiveFieldLayout = useMemo(() => {
    if (fieldLayoutProp && fieldLayoutProp.length > 0) return fieldLayoutProp
    if (modalLayoutProp?.blocks && modalLayoutProp.blocks.length > 0 && fields.length > 0) {
      return convertModalLayoutToFieldLayout(modalLayoutProp, fields)
    }
    if (modalFields.length > 0 && fields.length > 0) {
      return convertModalFieldsToFieldLayout(modalFields, fields)
    }
    return null
  }, [fieldLayoutProp, modalLayoutProp, modalFields, fields])

  const filteredFields = useMemo(() => {
    const exclude = (f: TableField) =>
      f && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at'

    if (effectiveFieldLayout && effectiveFieldLayout.length > 0) {
      return getVisibleFieldsFromLayout(effectiveFieldLayout, fields, visibilityContextProp).filter(exclude)
    }
    if (modalFields.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[record-editor-core] modalFields is deprecated. Use fieldLayout instead for unified field layout.'
        )
      }
      return fields.filter(
        (f) =>
          exclude(f) && (modalFields.includes(f.name) || modalFields.includes(f.id))
      )
    }
    return fields.filter(exclude)
  }, [fields, effectiveFieldLayout, modalFields, visibilityContextProp])

  const normalizeUpdateValue = useCallback(
    (fieldName: string, value: any): any => {
      const v: any = value === undefined ? null : value
      const field = fields.find((f) => f?.name === fieldName)
      if (!field || field.type !== 'link_to_table') return v
      return normalizeLinkValue(value, field)
    },
    [fields]
  )

  const persistFieldChange = useCallback(
    async (fieldName: string, value: any, oldValue: any) => {
      const tableToUse = supabaseTableNameProp ?? effectiveTableName
      if (!recordId || !tableToUse || !saveOnFieldChange) return
      if (cascadeContext != null && !canEditRecords) return

      const normalizedValue = normalizeUpdateValue(fieldName, value)
      const supabase = createClient()

      const doUpdate = async (val: any) =>
        supabase.from(tableToUse).update({ [fieldName]: val }).eq('id', recordId)

      let finalSavedValue: any = normalizedValue
      let { error } = await doUpdate(finalSavedValue)

      if (
        error?.code === '42804' &&
        !Array.isArray(finalSavedValue) &&
        String(error?.message || '').toLowerCase().includes('uuid[]')
      ) {
        const wrappedValue = finalSavedValue != null ? [finalSavedValue] : null
        const retry = await doUpdate(wrappedValue)
        error = retry.error
        if (!retry.error) finalSavedValue = wrappedValue
      }

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to update field',
          description: error.message || 'Please try again',
        })
        setFormData((prev) => ({ ...prev, [fieldName]: oldValue }))
        return
      }

      const field = fields.find((f) => f?.name === fieldName)
      if (field && field.type === 'link_to_table') {
        try {
          await syncLinkedFieldBidirectional(
            tableId,
            tableToUse,
            fieldName,
            recordId,
            finalSavedValue as string | string[] | null,
            oldValue as string | string[] | null,
            false
          )
        } catch (syncError) {
          console.error('[record-editor-core] Bidirectional sync failed:', syncError)
        }
      }

      const newBaseline = { ...formDataRef.current, [fieldName]: finalSavedValue }
      baselineFormDataRef.current = newBaseline
      setBaselineFormData(newBaseline)

      triggerRecordAutomations(tableId, 'row_updated', {
        ...formDataRef.current,
        [fieldName]: finalSavedValue,
        id: recordId,
      })
    },
    [
      recordId,
      effectiveTableName,
      supabaseTableNameProp,
      saveOnFieldChange,
      cascadeContext,
      canEditRecords,
      normalizeUpdateValue,
      tableId,
      fields,
      toast,
    ]
  )

  const handleFieldChange = useCallback(
    (fieldName: string, value: any) => {
      const oldValue = formDataRef.current[fieldName]
      setFormData((prev) => ({ ...prev, [fieldName]: value }))

      if (!saveOnFieldChange || !recordId) return
      if (cascadeContext != null && !canEditRecords) return

      const existing = debounceTimersRef.current.get(fieldName)
      if (existing) {
        clearTimeout(existing)
        debounceTimersRef.current.delete(fieldName)
      }

      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(fieldName)
        persistFieldChange(fieldName, value, oldValue)
      }, 400)

      debounceTimersRef.current.set(fieldName, timer)
    },
    [saveOnFieldChange, recordId, cascadeContext, canEditRecords, persistFieldChange]
  )

  const save = useCallback(async () => {
    if (!effectiveTableName) return
    // Optional defence-in-depth: only enforce when cascadeContext was provided; do not change successful paths
    if (cascadeContext != null) {
      if (recordId && !canEditRecords) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[record-editor-core] save() early-return: cascadeContext present and !canEditRecords (edit blocked by permissions).')
        }
        return
      }
      if (!recordId && !canCreateRecords) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[record-editor-core] save() early-return: cascadeContext present and !canCreateRecords (create blocked by permissions).')
        }
        return
      }
    }
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
        const newBaseline = { ...payload, id: recordId }
        baselineFormDataRef.current = newBaseline
        setBaselineFormData(newBaseline)
        clearDraft()
        triggerRecordAutomations(tableId, 'row_updated', { ...payload, id: recordId })
        onSave?.()
      } else {
        const { data, error } = await supabase
          .from(effectiveTableName)
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        const createdId = data?.id ?? null
        clearDraft()
        triggerRecordAutomations(tableId, 'row_created', data as Record<string, any>)
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
    tableId,
    onSave,
    cascadeContext,
    canEditRecords,
    canCreateRecords,
    clearDraft,
  ])

  const deleteRecord = useCallback(
    async (opts?: { confirmMessage?: string; skipConfirm?: boolean }) => {
      if (!recordId || !effectiveTableName) return
      // Optional defence-in-depth: only enforce when cascadeContext was provided
      if (cascadeContext != null && !canDeleteRecords) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[record-editor-core] deleteRecord() early-return: cascadeContext present and !canDeleteRecords (delete blocked by permissions).')
        }
        return
      }
      if (opts?.skipConfirm !== true) {
        const msg = opts?.confirmMessage ?? 'Are you sure you want to delete this record? This action cannot be undone.'
        if (!confirm(msg)) return
      }
      setDeleting(true)
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from(effectiveTableName)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', recordId)
        if (error) throw error
        triggerRecordAutomations(tableId, 'row_deleted', { ...formData, id: recordId })
        await onDeleted?.()
      } catch (e) {
        if (!isAbortError(e)) throw e
      } finally {
        setDeleting(false)
      }
    },
    [recordId, effectiveTableName, formData, tableId, onDeleted, cascadeContext, canDeleteRecords]
  )

  const restoreDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const draftRaw = localStorage.getItem(getDraftKey())
      if (!draftRaw) return
      const draft = JSON.parse(draftRaw) as { formData: Record<string, any> }
      setFormData(draft.formData)
      baselineFormDataRef.current = { ...draft.formData }
      setBaselineFormData({ ...draft.formData })
      clearDraft()
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.warn('Failed to restore draft:', e)
    }
  }, [getDraftKey, clearDraft])

  const isDirty = useMemo(() => {
    try {
      return JSON.stringify(formData) !== JSON.stringify(baselineFormData)
    } catch {
      return false
    }
  }, [formData, baselineFormData])

  return {
    loading,
    formData,
    setFormData,
    fields: filteredFields,
    allFields: fields,
    fieldLayout: effectiveFieldLayout ?? fieldLayoutProp ?? null,
    effectiveTableName,
    saving,
    deleting,
    isCreateMode,
    save,
    deleteRecord,
    handleFieldChange,
    normalizeUpdateValue,
    canEditRecords,
    canDeleteRecords,
    canCreateRecords,
    saveOnFieldChange,
    isDirty,
    hasDraftToRestore,
    restoreDraft,
    clearDraft,
  }
}
