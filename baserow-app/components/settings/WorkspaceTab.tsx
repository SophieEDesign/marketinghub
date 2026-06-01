"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { IconPicker } from '@/components/ui/icon-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateTimeUK } from '@/lib/utils'
import { TimeoutError, withTimeout } from '@/lib/with-timeout'
import { debugLog } from '@/lib/debug'
import { LANDING_DEFAULT_COLUMNS } from '@/lib/workspace-defaults'

const SETTINGS_LOAD_TIMEOUT_MS = 15_000

export default function SettingsWorkspaceTab() {
  const [workspaceName, setWorkspaceName] = useState('Marketing Hub')
  const [workspaceIcon, setWorkspaceIcon] = useState('📊')
  const [workspaceSlug, setWorkspaceSlug] = useState('marketing-hub')
  const [createdAt, setCreatedAt] = useState<string>('')
  const [ownerEmail, setOwnerEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [originalName, setOriginalName] = useState('Marketing Hub')
  const [originalIcon, setOriginalIcon] = useState('📊')
  const [adminDefaultPageId, setAdminDefaultPageId] = useState<string>('__none__')
  const [memberDefaultPageId, setMemberDefaultPageId] = useState<string>('__none__')
  const [originalAdminDefaultPageId, setOriginalAdminDefaultPageId] = useState<string>('__none__')
  const [originalMemberDefaultPageId, setOriginalMemberDefaultPageId] = useState<string>('__none__')
  const [interfacePages, setInterfacePages] = useState<Array<{ id: string; name: string; is_admin_only?: boolean | null }>>([])
  const [loadingPages, setLoadingPages] = useState(false)

  useEffect(() => {
    loadWorkspace()
    loadInterfacePages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toSelectValue(id: string | null | undefined): string {
    return id && id.length > 0 ? id : '__none__'
  }

  function applyDefaultPageSettings(
    settings: {
      default_interface_id?: string | null
      admin_default_interface_id?: string | null
      member_default_interface_id?: string | null
    } | null,
    settingsError: { code?: string; message?: string } | null
  ) {
    const reset = () => {
      setAdminDefaultPageId('__none__')
      setMemberDefaultPageId('__none__')
      setOriginalAdminDefaultPageId('__none__')
      setOriginalMemberDefaultPageId('__none__')
    }

    if (settingsError) {
      if (
        settingsError.code === '42P01' ||
        settingsError.code === '42703' ||
        settingsError.message?.includes('column') ||
        settingsError.message?.includes('does not exist') ||
        settingsError.message?.includes('relation')
      ) {
        reset()
      } else {
        console.warn('Error loading default page settings:', settingsError)
        reset()
      }
      return
    }

    const legacy = settings?.default_interface_id ?? null
    const adminId = settings?.admin_default_interface_id ?? legacy
    const memberId = settings?.member_default_interface_id ?? legacy
    const adminValue = toSelectValue(adminId)
    const memberValue = toSelectValue(memberId)
    setAdminDefaultPageId(adminValue)
    setMemberDefaultPageId(memberValue)
    setOriginalAdminDefaultPageId(adminValue)
    setOriginalMemberDefaultPageId(memberValue)
  }

  async function loadWorkspace() {
    setLoading(true)
    setMessage(null)
    try {
      await withTimeout(
        (async () => {
          const supabase = createClient()
          // getSession reads local cookies — avoids a slow/hanging auth server round-trip on mount
          const {
            data: { session },
          } = await supabase.auth.getSession()
          const user = session?.user

          const [workspaceResult, settingsResult] = await Promise.all([
            supabase
              .from('workspaces')
              .select('name, icon, created_at, created_by')
              .limit(1)
              .maybeSingle(),
            supabase
              .from('workspace_settings')
              .select(LANDING_DEFAULT_COLUMNS)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ])

          const { data, error } = workspaceResult

          if (!error && data) {
            const name = data.name || 'Marketing Hub'
            const icon = data.icon || '📊'
            setWorkspaceName(name)
            setWorkspaceIcon(icon)
            setOriginalName(name)
            setOriginalIcon(icon)
            setCreatedAt(data.created_at || '')

            const slug = name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
            setWorkspaceSlug(slug)

            if (user?.email) {
              setOwnerEmail(user.email)
            }
          } else {
            if (user?.email) {
              setOwnerEmail(user.email)
            }
            setCreatedAt(new Date().toISOString())
          }

          applyDefaultPageSettings(settingsResult.data, settingsResult.error)
        })(),
        SETTINGS_LOAD_TIMEOUT_MS,
        'Loading workspace settings timed out'
      )
    } catch (error) {
      if (error instanceof TimeoutError) {
        setMessage({
          type: 'error',
          text: 'Workspace settings took too long to load. Check your connection and refresh the page.',
        })
      } else {
        console.error('Error loading workspace:', error)
        setMessage({
          type: 'error',
          text: 'Could not load workspace settings. Please refresh and try again.',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadInterfacePages() {
    setLoadingPages(true)
    try {
      await withTimeout(
        (async () => {
      const supabase = createClient()
      
      // Load interface pages from interface_pages table (new system)
      // Don't filter by is_admin_only here - workspace settings should show all pages
      const { data: interfacePagesData, error: interfacePagesError } = await supabase
        .from('interface_pages')
        .select('id, name, is_admin_only')
        .order('name', { ascending: true })

      if (interfacePagesError) {
        console.error('Error loading interface pages from interface_pages table:', interfacePagesError)
        // Check if it's a table doesn't exist error
        if (interfacePagesError.code === '42P01' || interfacePagesError.code === 'PGRST116' || 
            interfacePagesError.message?.includes('relation') || 
            interfacePagesError.message?.includes('does not exist')) {
          console.warn('interface_pages table does not exist, falling back to views table')
        } else {
          // For other errors (like RLS), still try fallback
          console.warn('Error loading from interface_pages, trying fallback:', interfacePagesError.message)
        }
      }

      if (!interfacePagesError && interfacePagesData) {
        debugLog('Loaded', interfacePagesData.length, 'interface pages from interface_pages table')
        setInterfacePages(interfacePagesData)
        return
      }

      // Fallback to old views table for backward compatibility
      const { data: viewsData, error: viewsError } = await supabase
        .from('views')
        .select('id, name, is_admin_only')
        .eq('type', 'interface')
        .order('name', { ascending: true })

      if (viewsError) {
        console.error('Error loading interface pages from views table:', viewsError)
        setInterfacePages([])
      } else if (viewsData) {
        debugLog('Loaded', viewsData.length, 'interface pages from views table (fallback)')
        setInterfacePages(viewsData)
      } else {
        console.warn('No interface pages found in either table')
        setInterfacePages([])
      }
        })(),
        SETTINGS_LOAD_TIMEOUT_MS,
        'Loading interface pages timed out'
      )
    } catch (error) {
      if (error instanceof TimeoutError) {
        console.warn('Interface pages load timed out')
      } else {
        console.error('Exception loading interface pages:', error)
      }
      setInterfacePages([])
    } finally {
      setLoadingPages(false)
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
      let saveHadErrorMessage = false
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setMessage({ type: 'error', text: 'You must be logged in to save settings' })
        saveHadErrorMessage = true
        return
      }

      // Upsert workspace (create if doesn't exist, update if exists)
      const { error: workspaceError } = await supabase
        .from('workspaces')
        .upsert({
          id: 'default', // Single workspace for now
          name: workspaceName.trim(),
          icon: workspaceIcon || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })

      if (workspaceError) {
        // If table doesn't exist, that's okay for v1 - we'll just show a message
        console.error('Error saving workspace:', workspaceError)
        setMessage({ 
          type: 'error', 
          text: 'Could not save workspace settings. The workspaces table may need to be created.' 
        })
        saveHadErrorMessage = true
        return
      }

      // Save default page setting to workspace_settings
      let defaultPageSaveSuccess = false
      try {
        const adminInterfaceId =
          adminDefaultPageId === '__none__' ? null : adminDefaultPageId || null
        const memberInterfaceId =
          memberDefaultPageId === '__none__' ? null : memberDefaultPageId || null

        debugLog('[WorkspaceTab] Saving default pages:', {
          adminDefaultPageId,
          memberDefaultPageId,
          adminInterfaceId,
          memberInterfaceId,
        })
        
        // Get the first workspace_settings row (single-workspace app); avoid .single() to prevent 406/PGRST116 masking
        const { data: existingSettings, error: fetchError } = await supabase
          .from('workspace_settings')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (fetchError) {
          if (fetchError.code === '42P01' || fetchError.code === '42703' ||
              fetchError.message?.includes('column') || fetchError.message?.includes('does not exist') ||
              fetchError.message?.includes('relation')) {
            // Schema not present - cannot persist this setting
            setMessage({
              type: 'error',
              text: 'Default page could not be saved: the workspace_settings table/column is missing. Please run the workspace settings migrations.'
            })
            saveHadErrorMessage = true
          } else {
            console.error('[WorkspaceTab] Error fetching workspace settings:', fetchError)
            throw fetchError
          }
        } else if (existingSettings) {
          // Update existing row
          // Ensure workspace_id is set (in case it was NULL before the migration)
          let workspaceId: string | null = null
          
          // Get existing workspace
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('id')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          
          if (workspace) {
            workspaceId = workspace.id
          } else {
            // Create workspace if it doesn't exist
            const { data: newWorkspace } = await supabase
              .from('workspaces')
              .insert([{ name: workspaceName.trim() || 'Marketing Hub' }])
              .select('id')
              .single()
            
            if (newWorkspace) {
              workspaceId = newWorkspace.id
            }
          }
          
          debugLog('[WorkspaceTab] Updating existing workspace_settings row:', existingSettings.id, 'with workspace_id:', workspaceId)
          const updateData: Record<string, unknown> = {
            admin_default_interface_id: adminInterfaceId,
            member_default_interface_id: memberInterfaceId,
            default_interface_id: adminInterfaceId,
            updated_at: new Date().toISOString(),
          }
          
          // Only include workspace_id if we have one (don't overwrite with NULL)
          if (workspaceId) {
            updateData.workspace_id = workspaceId
          }
          
          const { data: updatedRows, error: updateError } = await supabase
            .from('workspace_settings')
            .update(updateData)
            .eq('id', existingSettings.id)
            .select(LANDING_DEFAULT_COLUMNS)
          
          if (updateError) {
            console.error('[WorkspaceTab] Update error:', {
              code: updateError.code,
              message: updateError.message,
              details: updateError
            })
            throw updateError
          } else if (updatedRows && updatedRows.length > 0) {
            const updatedData = updatedRows[0]
            debugLog('[WorkspaceTab] Successfully updated landing defaults:', {
              saved: updatedData,
              expectedAdmin: adminInterfaceId,
              expectedMember: memberInterfaceId,
            })
            defaultPageSaveSuccess = true
          } else {
            // UPDATE succeeded but returned 0 rows: almost always RLS "no update policy" (or wrong filter)
            throw new Error('Not permitted to update workspace settings (RLS policy may be missing for admins).')
          }
        } else {
          // No row exists, insert a new one
          // First, get or create workspace_id
          let workspaceId: string | null = null
          
          // Get existing workspace
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('id')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          
          if (workspace) {
            workspaceId = workspace.id
          } else {
            // Create workspace if it doesn't exist
            const { data: newWorkspace, error: createError } = await supabase
              .from('workspaces')
              .insert([{ name: workspaceName.trim() || 'Marketing Hub' }])
              .select('id')
              .single()
            
            if (!createError && newWorkspace) {
              workspaceId = newWorkspace.id
            } else {
              // Last resort: try 'default' if id is text type
              const { data: defaultWorkspace } = await supabase
                .from('workspaces')
                .insert([{ id: 'default', name: workspaceName.trim() || 'Marketing Hub' }])
                .select('id')
                .single()
              
              if (defaultWorkspace) {
                workspaceId = defaultWorkspace.id
              }
            }
          }
          
          if (!workspaceId) {
            throw new Error('No workspace found. Please create a workspace first.')
          }
          
          debugLog('[WorkspaceTab] No existing row, inserting new workspace_settings with workspace_id:', workspaceId)
          const { data: insertedRows, error: insertError } = await supabase
            .from('workspace_settings')
            .insert({
              workspace_id: workspaceId,
              admin_default_interface_id: adminInterfaceId,
              member_default_interface_id: memberInterfaceId,
              default_interface_id: adminInterfaceId,
            })
            .select(`id, ${LANDING_DEFAULT_COLUMNS}`)
          
          if (insertError) {
            console.error('[WorkspaceTab] Insert error:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError,
              hint: insertError.hint
            })
            throw insertError
          } else if (insertedRows && insertedRows.length > 0) {
            const insertedData = insertedRows[0]
            debugLog('[WorkspaceTab] Successfully inserted workspace_settings:', {
              id: insertedData?.id,
              saved: insertedData,
              expectedAdmin: adminInterfaceId,
              expectedMember: memberInterfaceId,
            })
            defaultPageSaveSuccess = true
          } else {
            throw new Error('Not permitted to insert workspace settings (RLS policy may be missing for admins).')
          }
        }
        
        // Verify the save by reading it back
        if (defaultPageSaveSuccess) {
          const { data: verifyData, error: verifyError } = await supabase
            .from('workspace_settings')
            .select(LANDING_DEFAULT_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (!verifyError && verifyData) {
            debugLog('[WorkspaceTab] Verified save - landing defaults in DB:', verifyData)
            if (
              verifyData.admin_default_interface_id !== adminInterfaceId ||
              verifyData.member_default_interface_id !== memberInterfaceId
            ) {
              console.warn('[WorkspaceTab] WARNING: Saved value does not match!', {
                expectedAdmin: adminInterfaceId,
                expectedMember: memberInterfaceId,
                actual: verifyData,
              })
            }
          } else if (verifyError) {
            console.warn('[WorkspaceTab] Could not verify save:', verifyError)
          }
        }
      } catch (settingsError: any) {
        console.error('[WorkspaceTab] Error saving default page setting:', settingsError)
        // Only treat schema-missing as non-fatal (cannot persist the setting)
        if (settingsError?.code === '42P01' || settingsError?.code === '42703' ||
            settingsError?.message?.includes('column') || settingsError?.message?.includes('does not exist') ||
            settingsError?.message?.includes('relation')) {
          debugLog('[WorkspaceTab] workspace_settings schema missing; cannot save default page')
        } else if (settingsError?.code === '23503') {
          // Foreign key constraint violation - the page ID doesn't exist in interface_pages
          console.error('[WorkspaceTab] Foreign key constraint violation - page ID not found:', {
            pageId: adminDefaultPageId,
            error: settingsError
          })
          setMessage({ 
            type: 'error', 
            text: `Workspace saved, but default page setting failed: The selected page no longer exists or the foreign key constraint is pointing to the wrong table. Please select a different page.` 
          })
          saveHadErrorMessage = true
        } else if (settingsError?.code === '42501' || settingsError?.message?.includes('permission denied')) {
          setMessage({
            type: 'error',
            text: 'Workspace saved, but default page setting failed: permission denied (RLS). Ensure the workspace_settings admin UPDATE/INSERT policies are installed.'
          })
          saveHadErrorMessage = true
        } else {
          // Show detailed error message
          const errorMessage = settingsError?.message || settingsError?.code || 'Unknown error'
          console.error('[WorkspaceTab] Save failed with error:', {
            code: settingsError?.code,
            message: errorMessage,
            details: settingsError
          })
          setMessage({ 
            type: 'error', 
            text: `Workspace saved, but default page setting failed: ${errorMessage}` 
          })
          saveHadErrorMessage = true
        }
      }

      // Only reload if save was successful (or if we didn't try to save default page)
      // Reload workspace settings to ensure we have the latest values from database
      await loadWorkspace()
      
      if (!saveHadErrorMessage) {
        setMessage({ type: 'success', text: 'Workspace settings saved successfully' })
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

  const hasUnsavedChanges =
    workspaceName !== originalName ||
    workspaceIcon !== originalIcon ||
    adminDefaultPageId !== originalAdminDefaultPageId ||
    memberDefaultPageId !== originalMemberDefaultPageId
  const selectedAdminPage = interfacePages.find((p) => p.id === adminDefaultPageId)
  const selectedMemberPage = interfacePages.find((p) => p.id === memberDefaultPageId)

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

          <div className="space-y-4 pt-2">
            <div>
              <h3 className="text-sm font-medium">Default pages at login</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose where admins and members land after signing in. Per-user defaults in their profile still take priority.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-default-page">Admin default page</Label>
              <Select
                value={adminDefaultPageId || '__none__'}
                onValueChange={(value) =>
                  setAdminDefaultPageId(value === '__none__' ? '__none__' : value)
                }
                disabled={loadingPages}
              >
                <SelectTrigger id="admin-default-page" className="max-w-md">
                  <SelectValue
                    placeholder={
                      loadingPages
                        ? 'Loading pages...'
                        : interfacePages.length === 0
                          ? 'No pages available'
                          : 'Select admin default page'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (use Marketing Home or first available)</SelectItem>
                  {interfacePages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                      {page.is_admin_only ? ' (admin-only)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-default-page">Member default page</Label>
              <Select
                value={memberDefaultPageId || '__none__'}
                onValueChange={(value) =>
                  setMemberDefaultPageId(value === '__none__' ? '__none__' : value)
                }
                disabled={loadingPages}
              >
                <SelectTrigger id="member-default-page" className="max-w-md">
                  <SelectValue
                    placeholder={
                      loadingPages
                        ? 'Loading pages...'
                        : interfacePages.length === 0
                          ? 'No pages available'
                          : 'Select member default page'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (use Marketing Home or first available)</SelectItem>
                  {interfacePages.length === 0 ? (
                    <SelectItem value="__no_member_pages__" disabled>
                      No pages available
                    </SelectItem>
                  ) : (
                    interfacePages.map((page) => (
                      <SelectItem
                        key={page.id}
                        value={page.id}
                        disabled={!!page.is_admin_only}
                      >
                        {page.name}
                        {page.is_admin_only ? ' (admin-only)' : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedMemberPage?.is_admin_only && (
                <p className="text-xs text-amber-600">
                  This page is admin-only. Members cannot open it — pick a page they can access.
                </p>
              )}
              {selectedAdminPage?.is_admin_only && (
                <p className="text-xs text-muted-foreground">
                  Admin default can be any page, including admin-only interfaces.
                </p>
              )}
            </div>

            {!loadingPages && interfacePages.length === 0 && (
              <p className="text-xs text-amber-600">
                No interface pages found. Create pages in the Pages tab to set defaults.
              </p>
            )}
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
                  {formatDateTimeUK(createdAt)}
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
