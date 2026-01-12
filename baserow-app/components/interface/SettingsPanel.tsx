"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, Save, Check } from "lucide-react"
import type { PageBlock, BlockConfig } from "@/lib/interface/types"
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

  // Initialize config from block - only when block changes or panel opens
  useEffect(() => {
    if (block && isOpen) {
      const blockConfig = block.config || {}
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
  }, [block?.id, isOpen])

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
      const { data: viewsData } = await supabase
        .from("views")
        .select("*")
        .eq("table_id", config.table_id)
      setViews((viewsData || []) as View[])

      // Load fields
      const { data: fieldsData } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", config.table_id)
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
    const safeConfig = validateShallowMerge(
      currentConfig as Record<string, any>,
      configToSave as Record<string, any>
    ) as BlockConfig
    
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
  }, [block, onSave, toast])

  // Validate config on change (for UI feedback)
  useEffect(() => {
    if (!block || !isOpen) return
    
    const validateConfig = async () => {
      const { validateBlockConfig } = await import("@/lib/interface/block-config-types")
      const validation = validateBlockConfig(block.type, config)
      setValidationErrors(validation.errors)
    }
    
    validateConfig()
  }, [config, block, isOpen])

  // Auto-save disabled - settings only save when Save button is clicked
  // This prevents loops and ensures settings are only saved when user explicitly saves

  if (!isOpen || !block) return null

  const updateConfig = (updates: Partial<BlockConfig>) => {
    setConfig({ ...config, ...updates })
  }

  const updateAppearance = (updates: Partial<BlockConfig['appearance']>) => {
    setConfig({
      ...config,
      appearance: { ...config.appearance, ...updates }
    })
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
      case "calendar":
      case "kanban":
      case "timeline":
        // List, Calendar, Kanban, and Timeline blocks use the same settings as Grid blocks
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
      case "kanban":
      case "timeline":
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
