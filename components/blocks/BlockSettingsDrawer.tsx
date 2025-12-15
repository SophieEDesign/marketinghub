'use client'

import { useState } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ViewBlock } from '@/types/database'

interface BlockSettingsDrawerProps {
  block: ViewBlock
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function BlockSettingsDrawer({
  block,
  open,
  onOpenChange,
}: BlockSettingsDrawerProps) {
  const [settings, setSettings] = useState(block.settings || {})
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClientSupabaseClient()
    try {
      await supabase
        .from('view_blocks')
        .update({ settings })
        .eq('id', block.id)
      onOpenChange(false)
      window.location.reload()
    } catch (error) {
      console.error('Error updating block:', error)
      setSaving(false)
    }
  }

  function handleSettingsChange(key: string, value: any) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block Settings</DialogTitle>
          <DialogDescription>
            Configure settings for {block.type} block
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {block.type === 'text' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <textarea
                value={settings.content || ''}
                onChange={(e) => handleSettingsChange('content', e.target.value)}
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          {block.type === 'kpi' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <Input
                  value={settings.label || ''}
                  onChange={(e) => handleSettingsChange('label', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Value</label>
                <Input
                  type="number"
                  value={settings.value || 0}
                  onChange={(e) =>
                    handleSettingsChange('value', parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </>
          )}
          {block.type === 'image' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Image URL</label>
                <Input
                  value={settings.src || ''}
                  onChange={(e) => handleSettingsChange('src', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Alt Text</label>
                <Input
                  value={settings.alt || ''}
                  onChange={(e) => handleSettingsChange('alt', e.target.value)}
                />
              </div>
            </>
          )}
          {block.type === 'embed' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Embed URL</label>
              <Input
                value={settings.url || ''}
                onChange={(e) => handleSettingsChange('url', e.target.value)}
              />
            </div>
          )}
          {block.type === 'html' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">HTML</label>
              <textarea
                value={settings.html || ''}
                onChange={(e) => handleSettingsChange('html', e.target.value)}
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
