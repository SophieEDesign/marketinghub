"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { IconPicker } from '@/components/ui/icon-picker'

export default function SettingsWorkspaceTab() {
  const [workspaceName, setWorkspaceName] = useState('Marketing Hub')
  const [workspaceIcon, setWorkspaceIcon] = useState('📊')
  const [workspaceSlug, setWorkspaceSlug] = useState('marketing-hub')
  const [createdAt, setCreatedAt] = useState<string>('')
  const [ownerEmail, setOwnerEmail] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [originalName, setOriginalName] = useState('Marketing Hub')
  const [originalIcon, setOriginalIcon] = useState('📊')

  useEffect(() => {
    loadWorkspace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadWorkspace() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      // Try to get workspace from workspaces table
      // Use maybeSingle() to handle missing table gracefully (returns null instead of error)
      const { data, error } = await supabase
        .from('workspaces')
        .select('name, icon, created_at, created_by')
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        const name = data.name || 'Marketing Hub'
        const icon = data.icon || '📊'
        setWorkspaceName(name)
        setWorkspaceIcon(icon)
        setOriginalName(name)
        setOriginalIcon(icon)
        setCreatedAt(data.created_at || '')
        
        // Generate slug from name
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        setWorkspaceSlug(slug)

        // Load owner email - use current user email for now
        // (admin.getUserById requires admin privileges, so we'll use current user)
        if (user?.email) {
          setOwnerEmail(user.email)
        }
      } else {
        // If table doesn't exist or no workspace found, use defaults
        if (user?.email) {
          setOwnerEmail(user.email)
        }
        setCreatedAt(new Date().toISOString())
      }
    } catch (error) {
      console.error('Error loading workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!workspaceName.trim()) {
      setMessage({ type: 'error', text: 'Workspace name is required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setMessage({ type: 'error', text: 'You must be logged in to save settings' })
        return
      }

      // Upsert workspace (create if doesn't exist, update if exists)
      const { error } = await supabase
        .from('workspaces')
        .upsert({
          id: 'default', // Single workspace for now
          name: workspaceName.trim(),
          icon: workspaceIcon || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })

      if (error) {
        // If table doesn't exist, that's okay for v1 - we'll just show a message
        console.error('Error saving workspace:', error)
        setMessage({ 
          type: 'error', 
          text: 'Could not save workspace settings. The workspaces table may need to be created.' 
        })
      } else {
        setMessage({ type: 'success', text: 'Workspace settings saved successfully' })
        setOriginalName(workspaceName.trim())
        setOriginalIcon(workspaceIcon || '📊')
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (error: any) {
      console.error('Error saving workspace:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to save workspace settings' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading workspace settings...</div>
        </CardContent>
      </Card>
    )
  }

  const hasUnsavedChanges = workspaceName !== originalName || workspaceIcon !== originalIcon

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Enter workspace name"
              className="max-w-md"
            />
          </div>

          <div className="space-y-2">
            <Label>Workspace Icon</Label>
            <IconPicker
              value={workspaceIcon}
              onChange={setWorkspaceIcon}
              placeholder="📊"
              className="max-w-md"
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Workspace Slug</span>
              <span className="font-mono text-muted-foreground">{workspaceSlug}</span>
            </div>
            {createdAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-muted-foreground">
                  {new Date(createdAt).toLocaleDateString()} at {new Date(createdAt).toLocaleTimeString()}
                </span>
              </div>
            )}
            {ownerEmail && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner</span>
                <span className="text-muted-foreground">{ownerEmail}</span>
              </div>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-md text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {hasUnsavedChanges && (
          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
