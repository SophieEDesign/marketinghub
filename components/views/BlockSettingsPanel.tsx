'use client'

import { useState, useEffect } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ViewBlock } from '@/types/database'

interface BlockSettingsPanelProps {
  block: ViewBlock | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onBlockUpdated: () => void
}

export default function BlockSettingsPanel({
  block,
  open,
  onOpenChange,
  onBlockUpdated,
}: BlockSettingsPanelProps) {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (block) {
      setSettings(block.settings || {})
    }
  }, [block])

  async function handleSave() {
    if (!block) return

    setSaving(true)
    const supabase = createClientSupabaseClient()
    
    try {
      const { error } = await supabase
        .from('view_blocks')
        .update({ settings })
        .eq('id', block.id)

      if (!error) {
        onBlockUpdated()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Error updating block:', error)
    } finally {
      setSaving(false)
    }
  }

  function handleSettingsChange(key: string, value: any) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (!block) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Block Settings</DialogTitle>
          <DialogDescription>
            Configure settings for {block.type} block
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {block.type === 'text' && (
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <textarea
                id="content"
                value={settings.content || ''}
                onChange={(e) => handleSettingsChange('content', e.target.value)}
                className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Enter text content..."
              />
            </div>
          )}

          {block.type === 'image' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="src">Image URL</Label>
                <Input
                  id="src"
                  value={settings.src || ''}
                  onChange={(e) => handleSettingsChange('src', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alt">Alt Text</Label>
                <Input
                  id="alt"
                  value={settings.alt || ''}
                  onChange={(e) => handleSettingsChange('alt', e.target.value)}
                  placeholder="Image description"
                />
              </div>
            </>
          )}

          {block.type === 'embed' && (
            <div className="space-y-2">
              <Label htmlFor="url">Embed URL</Label>
              <Input
                id="url"
                value={settings.url || ''}
                onChange={(e) => handleSettingsChange('url', e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          )}

          {block.type === 'stat' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={settings.label || ''}
                  onChange={(e) => handleSettingsChange('label', e.target.value)}
                  placeholder="Stat label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={settings.value || 0}
                  onChange={(e) =>
                    handleSettingsChange('value', parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </>
          )}

          {block.type === 'kpi' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={settings.label || ''}
                  onChange={(e) => handleSettingsChange('label', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={settings.value || 0}
                  onChange={(e) =>
                    handleSettingsChange('value', parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Input
                  id="format"
                  value={settings.format || 'number'}
                  onChange={(e) => handleSettingsChange('format', e.target.value)}
                  placeholder="number or currency"
                />
              </div>
            </>
          )}

          {block.type === 'table' && (
            <div className="space-y-2">
              <Label htmlFor="tableId">Table ID</Label>
              <Input
                id="tableId"
                value={settings.tableId || ''}
                onChange={(e) => handleSettingsChange('tableId', e.target.value)}
                placeholder="Table ID to display"
              />
            </div>
          )}

          {block.type === 'chart' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="chartType">Chart Type</Label>
                <Input
                  id="chartType"
                  value={settings.chartType || 'bar'}
                  onChange={(e) => handleSettingsChange('chartType', e.target.value)}
                  placeholder="bar, line, pie, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data (JSON)</Label>
                <textarea
                  id="data"
                  value={JSON.stringify(settings.data || [], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      handleSettingsChange('data', parsed)
                    } catch {
                      // Invalid JSON, keep as string for now
                    }
                  }}
                  className="w-full min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
            </>
          )}

          {block.type === 'html' && (
            <div className="space-y-2">
              <Label htmlFor="html">HTML</Label>
              <textarea
                id="html"
                value={settings.html || ''}
                onChange={(e) => handleSettingsChange('html', e.target.value)}
                className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder="<div>Your HTML here</div>"
              />
            </div>
          )}

          {block.type === 'divider' && (
            <div className="text-sm text-muted-foreground">
              Divider block has no settings.
            </div>
          )}

          {block.type === 'automation' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="automationId">Automation ID</Label>
                <Input
                  id="automationId"
                  value={settings.automationId || ''}
                  onChange={(e) => handleSettingsChange('automationId', e.target.value)}
                  placeholder="automation_..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Input
                  id="status"
                  value={settings.status || 'inactive'}
                  onChange={(e) => handleSettingsChange('status', e.target.value)}
                  placeholder="inactive / active"
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
