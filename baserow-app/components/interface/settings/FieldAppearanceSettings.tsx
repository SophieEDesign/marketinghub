"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockConfig } from "@/lib/interface/types"
import type { TableField } from "@/types/database"
import { createClient } from "@/lib/supabase/client"

interface FieldAppearanceSettingsProps {
  config: BlockConfig
  onUpdate: (updates: Partial<BlockConfig>) => void
}

/**
 * Field Block Appearance Settings
 * 
 * Controls ONLY block-level presentation:
 * - Layout (width, alignment)
 * - Visibility
 * - Label display (show/hide)
 * - Inline editing permissions (block-level behavior)
 * 
 * Does NOT control:
 * - Field data behavior (name, type, options, colors) - these are in Field Settings
 * - Validation rules
 * - Field relationships
 */
export default function FieldAppearanceSettings({
  config,
  onUpdate,
}: FieldAppearanceSettingsProps) {
  const [field, setField] = useState<TableField | null>(null)
  const allowInlineEdit = config.allow_inline_edit || false
  const editPermission = config.inline_edit_permission || 'both'
  const appearance = config.appearance || {}
  const showLabel = appearance.showTitle !== false // Default to true

  // Load field info to check if it's an attachment field
  useEffect(() => {
    if (config.field_id && config.table_id) {
      loadFieldInfo()
    } else {
      setField(null)
    }
  }, [config.field_id, config.table_id])

  async function loadFieldInfo() {
    if (!config.field_id || !config.table_id) return

    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("table_fields")
        .select("*")
        .eq("id", config.field_id)
        .eq("table_id", config.table_id)
        .single()

      if (data) {
        setField(data as TableField)
      }
    } catch (error) {
      console.error("Error loading field info:", error)
      setField(null)
    }
  }

  const isAttachmentField = field?.type === 'attachment'
  const attachmentDisplayStyle = appearance.attachment_display_style || field?.options?.attachment_display_style || 'thumbnails'
  const attachmentSize = appearance.attachment_size || field?.options?.attachment_preview_size || 'medium'
  const attachmentMaxVisible = appearance.attachment_max_visible || field?.options?.attachment_max_visible || 10

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-900">Block Layout</h3>
        <p className="text-xs text-gray-500">
          Control how this field block appears. Field settings (name, type, options) are configured in the Data tab.
        </p>
      </div>

      {/* Label Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="showLabel">Show Field Label</Label>
            <p className="text-xs text-gray-500">
              Display the field name above the value
            </p>
          </div>
          <Switch
            id="showLabel"
            checked={showLabel}
            onCheckedChange={(checked) => {
              onUpdate({
                appearance: {
                  ...appearance,
                  showTitle: checked,
                },
              })
            }}
          />
        </div>
      </div>

      {/* Attachment/Image Display Settings */}
      {isAttachmentField && (
        <div className="space-y-4 border-t border-gray-200 pt-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900">Attachment Display</h3>
            <p className="text-xs text-gray-500">
              Configure how attachments are displayed in this block
            </p>
          </div>

          {/* Display Style */}
          <div className="space-y-2">
            <Label htmlFor="attachment-display-style">Display Style</Label>
            <Select
              value={attachmentDisplayStyle}
              onValueChange={(value: 'thumbnails' | 'list' | 'hero' | 'cover' | 'gallery') => {
                onUpdate({
                  appearance: {
                    ...appearance,
                    attachment_display_style: value,
                  },
                })
              }}
            >
              <SelectTrigger id="attachment-display-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thumbnails">Thumbnails</SelectItem>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="hero">Hero (Large featured + thumbnails)</SelectItem>
                <SelectItem value="cover">Cover (Full-width banner)</SelectItem>
                <SelectItem value="gallery">Gallery (Responsive grid)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {attachmentDisplayStyle === 'thumbnails' && "Small square thumbnails in a row"}
              {attachmentDisplayStyle === 'list' && "List view with thumbnails and file details"}
              {attachmentDisplayStyle === 'hero' && "Large featured image with smaller thumbnails below"}
              {attachmentDisplayStyle === 'cover' && "Full-width banner image (first attachment only)"}
              {attachmentDisplayStyle === 'gallery' && "Responsive grid of square images"}
            </p>
          </div>

          {/* Size (only for thumbnails and list) */}
          {(attachmentDisplayStyle === 'thumbnails' || attachmentDisplayStyle === 'list') && (
            <div className="space-y-2">
              <Label htmlFor="attachment-size">Preview Size</Label>
              <Select
                value={attachmentSize}
                onValueChange={(value: 'small' | 'medium' | 'large') => {
                  onUpdate({
                    appearance: {
                      ...appearance,
                      attachment_size: value,
                    },
                  })
                }}
              >
                <SelectTrigger id="attachment-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Max Visible */}
          <div className="space-y-2">
            <Label htmlFor="attachment-max-visible">Max Visible</Label>
            <Input
              id="attachment-max-visible"
              type="number"
              min="1"
              max="50"
              value={attachmentMaxVisible}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 10
                onUpdate({
                  appearance: {
                    ...appearance,
                    attachment_max_visible: value,
                  },
                })
              }}
              className="text-sm"
            />
            <p className="text-xs text-gray-500">
              Maximum number of attachments to show before showing &quot;+X more&quot;
            </p>
          </div>
        </div>
      )}

      {/* Inline Editing Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="allowInlineEdit">Allow Inline Editing</Label>
            <p className="text-xs text-gray-500">
              Enable users to edit field values directly in this block
            </p>
          </div>
          <Switch
            id="allowInlineEdit"
            checked={allowInlineEdit}
            onCheckedChange={(checked) => {
              onUpdate({ 
                allow_inline_edit: checked,
                // Reset permission to 'both' when enabling if not set
                inline_edit_permission: checked && !config.inline_edit_permission ? 'both' : config.inline_edit_permission
              })
            }}
          />
        </div>
      </div>

      {/* Edit Permission Selector */}
      {allowInlineEdit && (
        <div className="space-y-2">
          <Label htmlFor="editPermission">Who Can Edit</Label>
          <Select
            value={editPermission}
            onValueChange={(value: 'admin' | 'member' | 'both') => {
              onUpdate({ inline_edit_permission: value })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Both Admin and Members</SelectItem>
              <SelectItem value="admin">Admin Only</SelectItem>
              <SelectItem value="member">Members Only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            {editPermission === 'both' && "Both admins and members can edit this field"}
            {editPermission === 'admin' && "Only admins can edit this field inline"}
            {editPermission === 'member' && "Only members can edit this field inline"}
          </p>
        </div>
      )}
    </div>
  )
}
