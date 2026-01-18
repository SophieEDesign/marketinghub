"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Save, Check } from "lucide-react"
import type { PageBlock, BlockConfig, BlockType } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"

// Import block-specific settings components
import KPIDataSettings from "./settings/KPIDataSettings"
import KPIAppearanceSettings from "./settings/KPIAppearanceSettings"
import ChartDataSettings from "./settings/ChartDataSettings"
import ChartAppearanceSettings from "./settings/ChartAppearanceSettings"
import TextDataSettings from "./settings/TextDataSettings"
import TextAppearanceSettings from "./settings/TextAppearanceSettings"
import ActionDataSettings from "./settings/ActionDataSettings"
import ActionAppearanceSettings from "./settings/ActionAppearanceSettings"
import LinkPreviewDataSettings from "./settings/LinkPreviewDataSettings"
import LinkPreviewAppearanceSettings from "./settings/LinkPreviewAppearanceSettings"
import GridDataSettings from "./settings/GridDataSettings"
import GridAppearanceSettings from "./settings/GridAppearanceSettings"
import ListDataSettings from "./settings/ListDataSettings"
import MultiSourceDataSettings from "./settings/MultiSourceDataSettings"
import FormDataSettings from "./settings/FormDataSettings"
import FormAppearanceSettings from "./settings/FormAppearanceSettings"
import RecordDataSettings from "./settings/RecordDataSettings"
import {
  guardAgainstConfigOverwrite,
  validateShallowMerge,
  markUserInteraction,
} from "@/lib/interface/editor-safety"
import ImageDataSettings from "./settings/ImageDataSettings"
import ImageAppearanceSettings from "./settings/ImageAppearanceSettings"
import DividerAppearanceSettings from "./settings/DividerAppearanceSettings"
import FilterBlockSettings from "./settings/FilterBlockSettings"
import FieldDataSettings from "./settings/FieldDataSettings"
import FieldAppearanceSettings from "./settings/FieldAppearanceSettings"
import ButtonDataSettings from "./settings/ButtonDataSettings"
import ButtonAppearanceSettings from "./settings/ButtonAppearanceSettings"
import AdvancedSettings from "./settings/AdvancedSettings"
import CommonAppearanceSettings from "./settings/CommonAppearanceSettings"
import { BLOCK_REGISTRY } from "@/lib/interface/registry"

interface SettingsPanelProps {
  block: PageBlock | null
  isOpen: boolean
  onClose: () => void
  onSave: (blockId: string, config: Partial<BlockConfig>) => void
  onMoveToTop?: (blockId: string) => void
  onMoveToBottom?: (blockId: string) => void
  onLock?: (blockId: string, locked: boolean) => void
  pageTableId?: string | null // Table ID from the page (for field blocks on record_view pages)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuidLike(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export default function SettingsPanel({
  block,
  isOpen,
  onClose,
  onSave,
  onMoveToTop,
  onMoveToBottom,
  onLock,
  pageTableId = null,
}: SettingsPanelProps) {
  const { toast } = useToast()
  const [tables, setTables] = useState<Table[]>([])
  const [views, setViews] = useState<View[]>([])
  const [fields, setFields] = useState<TableField[]>([])
  const [config, setConfig] = useState<BlockConfig>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousConfigRef = useRef<string>("")
  const isInitialLoadRef = useRef(true)

  const normalizeMultiSources = useCallback((sources: any[]) => {
    if (!Array.isArray(sources)) return []
    return sources.map((s: any, idx: number) => {
      if (!s || typeof s !== "object") return s
      return {
        ...s,
        id: s.id ?? s.source_id ?? s.sourceId ?? `source_${idx + 1}`,
        table_id: s.table_id ?? s.tableId ?? s.table ?? "",
        view_id: s.view_id ?? s.viewId,
        title_field: s.title_field ?? s.titleField ?? s.title ?? "",
        start_date_field: s.start_date_field ?? s.startDateField ?? s.start_date ?? "",
        end_date_field: s.end_date_field ?? s.endDateField ?? s.end_date,
        color_field: s.color_field ?? s.colorField,
        type_field: s.type_field ?? s.typeField,
      }
    })
  }, [])

  const normalizeConfigForValidation = useCallback(
    (blockType: BlockType | undefined, cfg: BlockConfig): BlockConfig => {
      const next = { ...(cfg || {}) } as any

      // Normalize legacy table ID keys
      const legacyTableId = next?.tableId
      const fallbackTableId =
        next?.table_id || legacyTableId || pageTableId || next?.base_table || undefined
      if (!next.table_id && fallbackTableId) {
        next.table_id = fallbackTableId
      }

      // Normalize multi-source shapes (camelCase → snake_case)
      if ((blockType === "multi_calendar" || blockType === "multi_timeline") && Array.isArray(next.sources)) {
        next.sources = normalizeMultiSources(next.sources)
      }

      return next as BlockConfig
    },
    [normalizeMultiSources, pageTableId]
  )

  // Initialize config from block - only when block changes or panel opens
  useEffect(() => {
    if (block && isOpen) {
      /**
       * NOTE: Many table-based blocks can render using the page-level table fallback (pageTableId)
       * even when block.config.table_id is empty (legacy data / older pages).
       *
       * If we don't hydrate a table_id here, the Settings UI can't load fields and
       * validation will block saves (making it look like "settings don't pull through").
       */
      const blockConfig = { ...(block.config || {}) } as BlockConfig

      // Hydrate table_id from the page when missing (keeps legacy pages editable)
      const legacyTableId = (blockConfig as any)?.tableId
      const fallbackTableId =
        (blockConfig as any)?.table_id ||
        legacyTableId ||
        pageTableId ||
        (blockConfig as any)?.base_table ||
        undefined
      if (!blockConfig.table_id && fallbackTableId) {
        blockConfig.table_id = fallbackTableId
      }

      // Normalize multi-source blocks so settings/validation work with legacy saved configs.
      if (
        (block.type === "multi_calendar" || block.type === "multi_timeline") &&
        Array.isArray((blockConfig as any).sources)
      ) {
        ;(blockConfig as any).sources = normalizeMultiSources((blockConfig as any).sources)
      }

      // Ensure calendar/kanban/timeline/table blocks have the correct view_type
      if (block.type === 'calendar' && !blockConfig.view_type) {
        blockConfig.view_type = 'calendar'
      } else if (block.type === 'kanban' && !blockConfig.view_type) {
        blockConfig.view_type = 'kanban'
      } else if (block.type === 'timeline' && !blockConfig.view_type) {
        blockConfig.view_type = 'timeline'
      }
      // Ensure chart blocks have a default chart_type if not set
      if (block.type === 'chart' && !blockConfig.chart_type) {
        blockConfig.chart_type = 'bar'
      }
      setConfig(blockConfig)
      // Store initial config as JSON for comparison
      previousConfigRef.current = JSON.stringify(blockConfig)
      isInitialLoadRef.current = true
    }
  }, [block?.id, isOpen, pageTableId, normalizeMultiSources])

  // Reset initial load flag after a short delay to allow initial render
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        isInitialLoadRef.current = false
      }, 100)
      return () => clearTimeout(timer)
    } else {
      isInitialLoadRef.current = true
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && block) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, block?.id, config.table_id])

  async function loadData() {
    const supabase = createClient()

    // Load tables
    const { data: tablesData } = await supabase.from("tables").select("*").order("name")
    setTables((tablesData || []) as Table[])

    // Load views if table is selected
    if (config.table_id) {
      // Robustness: table_id may be a legacy table name; resolve it to an actual UUID id.
      let effectiveTableId: string | null = config.table_id
      if (!isUuidLike(effectiveTableId)) {
        const byName = await supabase
          .from("tables")
          .select("id")
          .eq("name", effectiveTableId)
          .maybeSingle()
        if (!byName.error && byName.data?.id) {
          effectiveTableId = byName.data.id
        } else {
          const bySupabaseTable = await supabase
            .from("tables")
            .select("id")
            .eq("supabase_table", effectiveTableId)
            .maybeSingle()
          if (!bySupabaseTable.error && bySupabaseTable.data?.id) {
            effectiveTableId = bySupabaseTable.data.id
          } else {
            effectiveTableId = null
          }
        }

        // Update local config once so selects + dependent lookups work.
        if (effectiveTableId && effectiveTableId !== config.table_id) {
          setConfig((prev) => ({ ...(prev || {}), table_id: effectiveTableId as any }))
        }
      }

      if (!effectiveTableId) {
        setViews([])
        setFields([])
        return
      }

      const { data: viewsData } = await supabase
        .from("views")
        .select("*")
        .eq("table_id", effectiveTableId)
      setViews((viewsData || []) as View[])

      // Load fields
      const { data: fieldsData } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", effectiveTableId)
        .order("position")
      setFields((fieldsData || []) as TableField[])
    } else {
      setViews([])
      setFields([])
    }
  }

  const handleSave = useCallback(async (configToSave: BlockConfig) => {
    if (!block) return
    
    // Mark user interaction (save button click is a user action)
    markUserInteraction()
    
    // Pre-deployment guard: Validate config overwrite safety
    const currentConfig = block.config || {}
    const overwriteCheck = guardAgainstConfigOverwrite(
      currentConfig as Record<string, any>,
      configToSave as Record<string, any>,
      'block settings save'
    )
    
    if (overwriteCheck.blocked) {
      setValidationErrors([overwriteCheck.reason || 'Invalid save operation'])
      return
    }
    
    // Pre-deployment guard: Ensure shallow merge (don't overwrite unrelated config)
    let safeConfig = validateShallowMerge(
      currentConfig as Record<string, any>,
      configToSave as Record<string, any>
    ) as BlockConfig

    // Ensure table_id is persisted for legacy pages that relied on pageTableId fallback.
    // Without this, calendar/kanban/etc. may render (via fallback) but settings can't persist reliably.
    const legacyTableId = (safeConfig as any)?.tableId
    const fallbackTableId =
      safeConfig.table_id ||
      legacyTableId ||
      pageTableId ||
      (safeConfig as any)?.base_table ||
      undefined
    if (!safeConfig.table_id && fallbackTableId) {
      safeConfig = { ...safeConfig, table_id: fallbackTableId }
    }

    // Normalize legacy multi-source config keys before validation + save.
    safeConfig = normalizeConfigForValidation(block.type, safeConfig)

    // Robustness: If table_id is a legacy table name, resolve it to a UUID before validating/saving.
    // This prevents configs that "look valid" (truthy string) but break downstream queries that expect UUID ids.
    if (safeConfig.table_id && !isUuidLike(safeConfig.table_id)) {
      try {
        const supabase = createClient()
        const byName = await supabase
          .from("tables")
          .select("id")
          .eq("name", safeConfig.table_id)
          .maybeSingle()
        if (!byName.error && byName.data?.id) {
          safeConfig = { ...safeConfig, table_id: byName.data.id }
        } else {
          const bySupabaseTable = await supabase
            .from("tables")
            .select("id")
            .eq("supabase_table", safeConfig.table_id)
            .maybeSingle()
          if (!bySupabaseTable.error && bySupabaseTable.data?.id) {
            safeConfig = { ...safeConfig, table_id: bySupabaseTable.data.id }
          }
        }
      } catch (e) {
        // Non-fatal: validation will still catch missing/invalid ids if resolution failed.
      }
    }
    
    // Validate config before saving
    const { validateBlockConfig } = await import("@/lib/interface/block-config-types")
    const validation = validateBlockConfig(block.type, safeConfig)
    
    if (!validation.valid) {
      setValidationErrors(validation.errors)
      toast({
        variant: "destructive",
        title: "Configuration errors",
        description: validation.errors.join(". ") || "Please fix the configuration errors before saving.",
      })
      return // Don't save invalid configs
    }
    
    // Clear validation errors if config is valid
    setValidationErrors([])
    
    // Prevent saving if config hasn't actually changed
    const configToSaveJson = JSON.stringify(safeConfig)
    if (configToSaveJson === previousConfigRef.current) {
      return
    }
    
    setSaving(true)
    setSaved(false)
    try {
      // Save the validated, safely merged config object
      await onSave(block.id, safeConfig)
      setSaved(true)
      // Update previous config ref to prevent re-saving
      previousConfigRef.current = configToSaveJson
      setTimeout(() => setSaved(false), 2000)
      // Don't reload - let the parent component handle updates
      // This prevents interrupting the save process and losing user context
    } catch (error: any) {
      console.error("Failed to save block settings:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to save settings. Please try again."
      setValidationErrors([errorMessage])
      toast({
        variant: "destructive",
        title: "Failed to save settings",
        description: errorMessage,
      })
    } finally {
      setSaving(false)
    }
  }, [block, onSave, toast, pageTableId, normalizeConfigForValidation])

  // Validate config on change (for UI feedback)
  useEffect(() => {
    if (!block || !isOpen) return
    
    const validateConfig = async () => {
      const { validateBlockConfig } = await import("@/lib/interface/block-config-types")
      const normalized = normalizeConfigForValidation(block.type, config)
      const validation = validateBlockConfig(block.type, normalized)
      setValidationErrors(validation.errors)
    }
    
    validateConfig()
  }, [config, block, isOpen, normalizeConfigForValidation])

  // Auto-save disabled - settings only save when Save button is clicked
  // This prevents loops and ensures settings are only saved when user explicitly saves

  if (!isOpen || !block) return null

  const updateConfig = (updates: Partial<BlockConfig>) => {
    // Functional update prevents stale-closure merges when multiple updates happen quickly.
    setConfig((prev) => ({ ...(prev || {}), ...updates }))
  }

  const updateAppearance = (updates: Partial<BlockConfig['appearance']>) => {
    // Functional update prevents stale-closure merges when multiple updates happen quickly.
    setConfig((prev) => ({
      ...(prev || {}),
      appearance: { ...((prev || {}).appearance || {}), ...updates },
    }))
  }

  const blockTypeLabel = block ? BLOCK_REGISTRY[block.type]?.label || block.type : ''

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        {blockTypeLabel && (
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            {blockTypeLabel}
          </div>
        )}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Block Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tabs - All blocks have three tabs */}
      <Tabs defaultValue="data" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 border-b border-gray-200 rounded-none h-auto">
          <TabsTrigger value="data" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600">
            Data
          </TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600">
            Appearance
          </TabsTrigger>
          <TabsTrigger value="advanced" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600">
            Advanced
          </TabsTrigger>
        </TabsList>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-semibold text-red-800 mb-1">Configuration Errors</p>
              <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          <TabsContent value="data" className="mt-0 space-y-6">
            {renderDataSettings()}
          </TabsContent>

          <TabsContent value="appearance" className="mt-0 space-y-6">
            {renderAppearanceSettings()}
          </TabsContent>

          <TabsContent value="advanced" className="mt-0 space-y-6">
            <AdvancedSettings
              block={block}
              config={config}
              onUpdate={updateConfig}
              onMoveToTop={onMoveToTop}
              onMoveToBottom={onMoveToBottom}
              onLock={onLock}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer */}
      <div className="h-16 border-t border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {saving && (
            <>
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Saving...</span>
            </>
          )}
          {saved && !saving && (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            size="sm"
          >
            Close
          </Button>
          <Button
            onClick={() => handleSave(config)}
            disabled={saving}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )

  function renderDataSettings() {
    const commonProps = {
      config,
      tables,
      views,
      fields,
      onUpdate: updateConfig,
      onTableChange: async (tableId: string) => {
        updateConfig({ table_id: tableId })
        if (tableId) {
          const supabase = createClient()
          const [viewsRes, fieldsRes] = await Promise.all([
            supabase.from("views").select("*").eq("table_id", tableId),
            supabase.from("table_fields").select("*").eq("table_id", tableId).order("position"),
          ])
          setViews((viewsRes.data || []) as View[])
          setFields((fieldsRes.data || []) as TableField[])
        }
      },
    }

    // Backward compatibility: normalize 'table' type to 'grid' (not in BlockType union but may exist in legacy data)
    const normalizedBlockType = ((block?.type as string | undefined) === 'table' ? 'grid' : block?.type) as BlockType | undefined

    switch (normalizedBlockType) {
      case "kpi":
        return <KPIDataSettings {...commonProps} />
      case "chart":
        return <ChartDataSettings {...commonProps} />
      case "text":
        return <TextDataSettings {...commonProps} />
      case "action":
        return <ActionDataSettings {...commonProps} />
      case "link_preview":
        return <LinkPreviewDataSettings {...commonProps} />
      case "grid":
        return <GridDataSettings {...commonProps} />
      case "form":
        return <FormDataSettings {...commonProps} />
      case "record":
        return <RecordDataSettings {...commonProps} />
      case "image":
        return <ImageDataSettings {...commonProps} />
      case "filter":
        return <FilterBlockSettings {...commonProps} allBlocks={[]} />
      case "field":
        return <FieldDataSettings {...commonProps} pageTableId={pageTableId} />
      case "number":
        return <FieldDataSettings {...commonProps} pageTableId={pageTableId} />
      case "button":
        return <ButtonDataSettings {...commonProps} />
      case "list":
        // List blocks have their own settings for field configuration
        return <ListDataSettings {...commonProps} />
      case "multi_calendar":
      case "multi_timeline":
        return <MultiSourceDataSettings {...commonProps} />
      case "calendar":
      case "kanban":
      case "timeline":
      case "gallery":
        // Calendar, Kanban, and Timeline blocks use the same settings as Grid blocks
        // They're grid blocks with different view_type values
        return <GridDataSettings {...commonProps} />
      default:
        return (
          <div className="text-sm text-gray-500">
            No data settings available for this block type.
          </div>
        )
    }
  }

  function renderAppearanceSettings() {
    const commonProps = {
      config,
      onUpdate: updateAppearance,
    }

    // Backward compatibility: normalize 'table' type to 'grid' (not in BlockType union but may exist in legacy data)
    const normalizedBlockType = ((block?.type as string | undefined) === 'table' ? 'grid' : block?.type) as BlockType | undefined

    switch (normalizedBlockType) {
      case "kpi":
        return (
          <>
            <KPIAppearanceSettings {...commonProps} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "chart":
        return (
          <>
            <ChartAppearanceSettings {...commonProps} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "text":
        return (
          <>
            <TextAppearanceSettings {...commonProps} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "action":
        return (
          <>
            <ActionAppearanceSettings 
              {...commonProps} 
              onConfigUpdate={updateConfig}
            />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "link_preview":
        return (
          <>
            <LinkPreviewAppearanceSettings {...commonProps} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "form":
        return (
          <>
            <FormAppearanceSettings {...commonProps} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "image":
        return (
          <>
            <ImageAppearanceSettings {...commonProps} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "divider":
        return (
          <>
            <DividerAppearanceSettings {...commonProps} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "grid":
        return (
          <>
            <GridAppearanceSettings {...commonProps} fields={fields} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "field":
        return (
          <>
            <FieldAppearanceSettings {...commonProps} onUpdate={updateConfig} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "number":
        return (
          <>
            <FieldAppearanceSettings {...commonProps} onUpdate={updateConfig} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "button":
        return (
          <>
            <ButtonAppearanceSettings {...commonProps} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      case "list":
      case "calendar":
      case "multi_calendar":
      case "kanban":
      case "timeline":
      case "multi_timeline":
      case "gallery":
        // List, Calendar, Kanban, and Timeline blocks use the same appearance settings as Grid blocks
        return (
          <>
            <GridAppearanceSettings {...commonProps} fields={fields} />
            <CommonAppearanceSettings {...commonProps} />
          </>
        )
      default:
        return <CommonAppearanceSettings {...commonProps} />
    }
  }
}
