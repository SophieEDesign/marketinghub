"use client"

import { useState, useEffect, useRef } from "react"
import { X, Upload, Image as ImageIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PageBlock, BlockConfig } from "@/lib/interface/types"
import type { Table, View, Automation, TableField } from "@/types/database"

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function ImageBlockSettings({ config, setConfig }: { config: BlockConfig; setConfig: (config: BlockConfig) => void }) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `interface-images/${generateUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, { upsert: false })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('Failed to upload image. Please try again.')
        return
      }

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath)

      setConfig({ ...config, image_url: urlData.publicUrl })
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div>
        <Label htmlFor="image-upload">Upload Image</Label>
        <div className="mt-1">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="image-upload"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Select Image"}
          </Button>
        </div>
        {config.image_url && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.image_url}
              alt={config.image_alt || ""}
              className="max-w-full h-32 object-contain rounded-md border border-gray-200"
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="image-url">Image URL</Label>
        <Input
          id="image-url"
          type="url"
          value={config.image_url || ""}
          onChange={(e) => setConfig({ ...config, image_url: e.target.value })}
          placeholder="https://example.com/image.jpg"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Or paste an image URL directly
        </p>
      </div>

      <div>
        <Label htmlFor="image-alt">Alt Text</Label>
        <Input
          id="image-alt"
          type="text"
          value={config.image_alt || ""}
          onChange={(e) => setConfig({ ...config, image_alt: e.target.value })}
          placeholder="Description of the image"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="image-alignment">Alignment</Label>
        <Select
          value={config.image_alignment || "center"}
          onValueChange={(value) => setConfig({ ...config, image_alignment: value })}
        >
          <SelectTrigger id="image-alignment" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="image-width">Width</Label>
        <Select
          value={config.image_width || "auto"}
          onValueChange={(value) => setConfig({ ...config, image_width: value })}
        >
          <SelectTrigger id="image-width" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="full">Full Width</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  )
}

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
  const [automations, setAutomations] = useState<Automation[]>([])
  const [config, setConfig] = useState<BlockConfig>({})

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

    // Load automations
    const { data: automationsData } = await supabase
      .from("automations")
      .select("*")
      .eq("enabled", true)
    setAutomations((automationsData || []) as Automation[])

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

  async function handleSave() {
    if (block) {
      try {
        await onSave(block.id, config)
        // Don't close automatically - let user see the changes
        // onClose()
      } catch (error) {
        console.error("Failed to save block settings:", error)
        alert("Failed to save settings. Please try again.")
      }
    }
  }

  if (!isOpen || !block) return null

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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={config.title || ""}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Block title"
          />
        </div>

        {/* Block-specific settings */}
        {renderBlockSettings()}
      </div>

      {/* Block Actions */}
      {(onMoveToTop || onMoveToBottom || onLock) && (
        <div className="border-t border-gray-200 p-4 space-y-2">
          <Label className="text-xs font-semibold text-gray-700 uppercase">Block Actions</Label>
          <div className="flex flex-col gap-2">
            {onMoveToTop && (
              <button
                onClick={() => {
                  if (block) onMoveToTop(block.id)
                }}
                className="w-full px-3 py-2 text-sm text-left text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Move to Top
              </button>
            )}
            {onMoveToBottom && (
              <button
                onClick={() => {
                  if (block) onMoveToBottom(block.id)
                }}
                className="w-full px-3 py-2 text-sm text-left text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                Move to Bottom
              </button>
            )}
            {onLock && (
              <button
                onClick={() => {
                  if (block) {
                    const isLocked = block.config?.locked || false
                    onLock(block.id, !isLocked)
                  }
                }}
                className="w-full px-3 py-2 text-sm text-left text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                {block?.config?.locked ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Unlock Block
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Lock Block (View Only)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="h-16 border-t border-gray-200 flex items-center justify-between px-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Close
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </div>
  )

  function renderBlockSettings() {
    switch (block?.type) {
      case "grid":
      case "form":
      case "record":
      case "chart":
      case "kpi":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Table</label>
              <select
                value={config.table_id || ""}
                onChange={async (e) => {
                  const newTableId = e.target.value
                  const newConfig = { ...config, table_id: newTableId }
                  setConfig(newConfig)
                  
                  // Clear dependent fields
                  if (!newTableId) {
                    setViews([])
                    setFields([])
                    return
                  }

                  // Reload views and fields for new table
                  const supabase = createClient()
                  const [viewsRes, fieldsRes] = await Promise.all([
                    supabase.from("views").select("*").eq("table_id", newTableId),
                    supabase.from("table_fields").select("*").eq("table_id", newTableId).order("position"),
                  ])
                  
                  setViews((viewsRes.data || []) as View[])
                  setFields((fieldsRes.data || []) as TableField[])
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>

            {(block.type === "grid" || block.type === "record") && (
              <div>
                <label className="block text-sm font-medium mb-1">View</label>
                <select
                  value={config.view_id || ""}
                  onChange={(e) => setConfig({ ...config, view_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  disabled={!config.table_id}
                >
                  <option value="">Select a view...</option>
                  {views.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {block.type === "record" && (
              <div>
                <label className="block text-sm font-medium mb-1">Record ID</label>
                <input
                  type="text"
                  value={config.record_id || ""}
                  onChange={(e) => setConfig({ ...config, record_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Enter record ID"
                />
              </div>
            )}

            {block.type === "chart" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Chart Type</label>
                  <select
                    value={config.chart_type || "bar"}
                    onChange={(e) =>
                      setConfig({ ...config, chart_type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="pie">Pie</option>
                    <option value="area">Area</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">X-Axis Field</label>
                  <select
                    value={config.chart_x_axis || ""}
                    onChange={(e) => setConfig({ ...config, chart_x_axis: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={!config.table_id}
                  >
                    <option value="">Select field...</option>
                    {fields.map((field) => (
                      <option key={field.id} value={field.name}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Y-Axis Field</label>
                  <select
                    value={config.chart_y_axis || ""}
                    onChange={(e) => setConfig({ ...config, chart_y_axis: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={!config.table_id}
                  >
                    <option value="">Select field...</option>
                    {fields.map((field) => (
                      <option key={field.id} value={field.name}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {block.type === "kpi" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Field</label>
                  <select
                    value={config.kpi_field || ""}
                    onChange={(e) => setConfig({ ...config, kpi_field: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    disabled={!config.table_id}
                  >
                    <option value="">Count (all records)</option>
                    {fields.map((field) => (
                      <option key={field.id} value={field.name}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Aggregate</label>
                  <select
                    value={config.kpi_aggregate || "count"}
                    onChange={(e) =>
                      setConfig({ ...config, kpi_aggregate: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="count">Count</option>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Label</label>
                  <input
                    type="text"
                    value={config.kpi_label || ""}
                    onChange={(e) => setConfig({ ...config, kpi_label: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="KPI label"
                  />
                </div>
              </>
            )}
          </>
        )

      case "button":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Button Label</label>
              <input
                type="text"
                value={config.button_label || ""}
                onChange={(e) => setConfig({ ...config, button_label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Click Me"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Automation</label>
              <select
                value={config.button_automation_id || ""}
                onChange={(e) =>
                  setConfig({ ...config, button_automation_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select automation...</option>
                {automations.map((automation) => (
                  <option key={automation.id} value={automation.id}>
                    {automation.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )

      case "image":
        return <ImageBlockSettings config={config} setConfig={setConfig} />

      default:
        return null
    }
  }
}
