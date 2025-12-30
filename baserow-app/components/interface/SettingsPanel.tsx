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

// Import block-specific settings components
import KPIDataSettings from "./settings/KPIDataSettings"
import KPIAppearanceSettings from "./settings/KPIAppearanceSettings"
import ChartDataSettings from "./settings/ChartDataSettings"
import ChartAppearanceSettings from "./settings/ChartAppearanceSettings"
import TableSnapshotDataSettings from "./settings/TableSnapshotDataSettings"
import TableSnapshotAppearanceSettings from "./settings/TableSnapshotAppearanceSettings"
import TextDataSettings from "./settings/TextDataSettings"
import TextAppearanceSettings from "./settings/TextAppearanceSettings"
import ActionDataSettings from "./settings/ActionDataSettings"
import ActionAppearanceSettings from "./settings/ActionAppearanceSettings"
import LinkPreviewDataSettings from "./settings/LinkPreviewDataSettings"
import LinkPreviewAppearanceSettings from "./settings/LinkPreviewAppearanceSettings"
import AdvancedSettings from "./settings/AdvancedSettings"
import CommonAppearanceSettings from "./settings/CommonAppearanceSettings"

interface SettingsPanelProps {
  block: PageBlock | null
  isOpen: boolean
  onClose: () => void
  onSave: (blockId: string, config: Partial<BlockConfig>) => void
  onMoveToTop?: (blockId: string) => void
  onMoveToBottom?: (blockId: string) => void
  onLock?: (blockId: string, locked: boolean) => void
}

export default function SettingsPanel({
  block,
  isOpen,
  onClose,
  onSave,
  onMoveToTop,
  onMoveToBottom,
  onLock,
}: SettingsPanelProps) {
  const [tables, setTables] = useState<Table[]>([])
  const [views, setViews] = useState<View[]>([])
  const [fields, setFields] = useState<TableField[]>([])
  const [config, setConfig] = useState<BlockConfig>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (block) {
      setConfig(block.config || {})
    }
  }, [block])

  useEffect(() => {
    if (isOpen && block) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, block, config.table_id])

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

  const handleSave = useCallback(async () => {
    if (!block) return
    
    setSaving(true)
    setSaved(false)
    try {
      await onSave(block.id, config)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error("Failed to save block settings:", error)
      alert("Failed to save settings. Please try again.")
    } finally {
      setSaving(false)
    }
  }, [block, config, onSave])

  // Auto-save on config change (debounced)
  useEffect(() => {
    if (!block || !isOpen) return
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      handleSave()
    }, 1500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [config, block, isOpen, handleSave])

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

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4">
        <h2 className="text-lg font-semibold">Block Settings</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
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
            onClick={handleSave}
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

    switch (block?.type) {
      case "kpi":
        return <KPIDataSettings {...commonProps} />
      case "chart":
        return <ChartDataSettings {...commonProps} />
      case "table_snapshot":
        return <TableSnapshotDataSettings {...commonProps} />
      case "text":
        return <TextDataSettings {...commonProps} />
      case "action":
        return <ActionDataSettings {...commonProps} />
      case "link_preview":
        return <LinkPreviewDataSettings {...commonProps} />
      case "grid":
      case "form":
      case "record":
        // Grid/Form/Record blocks use common data settings
        return (
          <div className="space-y-4">
            <div>
              <Label>Table</Label>
              <Select
                value={config.table_id || ""}
                onValueChange={commonProps.onTableChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {config.table_id && (
              <div>
                <Label>View (optional)</Label>
                <Select
                  value={config.view_id || ""}
                  onValueChange={(value) => updateConfig({ view_id: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All records" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All records</SelectItem>
                    {views.map((view) => (
                      <SelectItem key={view.id} value={view.id}>
                        {view.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )
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

    switch (block?.type) {
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
      case "table_snapshot":
        return (
          <>
            <TableSnapshotAppearanceSettings {...commonProps} />
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
            <ActionAppearanceSettings {...commonProps} />
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
      default:
        return <CommonAppearanceSettings {...commonProps} />
    }
  }
}
