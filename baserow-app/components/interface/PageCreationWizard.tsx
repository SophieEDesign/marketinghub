"use client"

// Interfaces group pages. Pages render content. Creation flows must never mix the two.

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { createClient } from "@/lib/supabase/client"
import { PageType, PAGE_TYPE_DEFINITIONS, getRequiredAnchorType, isRecordViewPage } from "@/lib/interface/page-types"
import { createRecordReviewTwoColumnLayout } from "@/lib/interface/record-review-layout"
import { FileCheck, BookOpen } from "lucide-react"

interface PageCreationWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultGroupId?: string | null
}

type WizardStep = 'interface' | 'purpose' | 'anchor' | 'name'

export default function PageCreationWizard({
  open,
  onOpenChange,
  defaultGroupId,
}: PageCreationWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>('interface')
  const [selectedInterfaceId, setSelectedInterfaceId] = useState<string>(defaultGroupId || '')
  const [pagePurpose, setPagePurpose] = useState<'record' | 'content'>('content')
  const [pageType, setPageType] = useState<PageType | ''>('')
  const [tableId, setTableId] = useState<string>('') // Users select tables, not views
  const [pageName, setPageName] = useState('')
  const [creating, setCreating] = useState(false)
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [interfaceGroups, setInterfaceGroups] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadTables()
      loadInterfaceGroups()
      // Reset state
      setStep('interface')
      setSelectedInterfaceId(defaultGroupId || '')
      setPagePurpose('content')
      setPageType('')
      setTableId('')
      setPageName('')
    }
  }, [open, defaultGroupId])

  async function loadInterfaceGroups() {
    try {
      const supabase = createClient()
      
      // Load from interface_groups table (interface_pages.group_id references this)
      const { data, error } = await supabase
        .from('interface_groups')
        .select('id, name')
        .order('order_index', { ascending: true })
        .order('name', { ascending: true })

      if (!error && data) {
        // Remove duplicates by id (in case there are any)
        const uniqueGroups = Array.from(
          new Map(data.map(g => [g.id, g])).values()
        )
        
        setInterfaceGroups(uniqueGroups)
        // If defaultGroupId is provided and exists, select it
        if (defaultGroupId && uniqueGroups.find(g => g.id === defaultGroupId)) {
          setSelectedInterfaceId(defaultGroupId)
        } else if (uniqueGroups.length > 0 && !selectedInterfaceId) {
          // Auto-select first interface if none selected
          setSelectedInterfaceId(uniqueGroups[0].id)
        }
      } else if (error) {
        console.error('Error loading interface groups:', error)
        // If interface_groups doesn't exist, try loading from interfaces table
        // and create a mapping (though this won't work for creating pages since
        // interface_pages.group_id must reference interface_groups)
        const { data: interfacesData, error: interfacesError } = await supabase
          .from('interfaces')
          .select('id, name')
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true })

        if (!interfacesError && interfacesData && interfacesData.length > 0) {
          // Map interfaces to groups format
          const interfaceOptions = interfacesData.map(iface => ({
            id: iface.id,
            name: iface.name,
          }))

          setInterfaceGroups(interfaceOptions)
          if (defaultGroupId && interfaceOptions.find(g => g.id === defaultGroupId)) {
            setSelectedInterfaceId(defaultGroupId)
          } else if (interfaceOptions.length > 0 && !selectedInterfaceId) {
            setSelectedInterfaceId(interfaceOptions[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Error loading interface groups:', error)
    }
  }

  // Removed loadViews() - users select tables, not views
  // Views are created automatically behind the scenes

  async function loadTables() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tables')
        .select('id, name')
        .order('name')

      if (!error && data) {
        setTables(data)
        if (data.length > 0 && !tableId) {
          setTableId(data[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading tables:', error)
    }
  }

  const handleInterfaceSelect = () => {
    if (!selectedInterfaceId) {
      alert('Please select an Interface')
      return
    }
    setStep('purpose')
  }

  const handlePurposeSelect = (purpose: 'record' | 'content') => {
    setPagePurpose(purpose)
    
    // Auto-select default page type for purpose
    switch (purpose) {
      case 'record':
        setPageType('record_view')
        // Record View pages skip view type selection - go to anchor step for table selection
        setStep('anchor')
        return
      case 'content':
        setPageType('content')
        // Skip anchor step for content pages - go directly to name
        setStep('name')
        return
    }
  }

  const handleAnchorConfigured = () => {
    setStep('name')
  }

  const handleCreate = async () => {
    if (!pageName.trim() || !pageType) {
      alert('Please complete all required fields')
      return
    }

    if (!selectedInterfaceId) {
      alert('Please select an Interface')
      return
    }

    // Unified architecture: Pages don't require anchors - blocks define their own data sources
    // Record view pages may optionally use a table for context, but it's not required
    // Content pages don't require any data sources

    setCreating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Prepare anchor fields
      // Users select tables, not views - views are created automatically
      let saved_view_id: string | null = null
      let dashboard_layout_id: string | null = null
      let form_config_id: string | null = null
      let record_config_id: string | null = null
      let base_table: string | null = null

      // Unified architecture: Pages don't require anchors
      // Blocks define their own data sources
      // Optional: Store base_table if provided for record_view pages (for block context)
      if (tableId && tableId.trim() && pageType === 'record_view') {
        base_table = tableId.trim()
        
        // Create a grid view for data access (optional - blocks can use their own views)
        // Check for existing views with the same name to avoid duplicate key errors
        const baseViewName = `${pageName.trim()} View`
        let viewName = baseViewName
        let counter = 1
        let recordView: any = null
        let viewCreated = false
        const maxAttempts = 100 // Safety limit
        
        // Try to create view with retry logic for duplicate names
        while (!viewCreated && counter <= maxAttempts) {
          // Check if view name already exists
          const { data: existingViews } = await supabase
            .from('views')
            .select('id')
            .eq('table_id', tableId)
            .eq('name', viewName)
            .is('is_archived', false)
            .limit(1)
          
          // If name doesn't exist, try to create it
          if (!existingViews || existingViews.length === 0) {
            const { data: newView, error: viewError } = await supabase
              .from('views')
              .insert([
                {
                  table_id: tableId,
                  name: viewName,
                  type: 'grid',
                  config: {},
                  access_level: 'authenticated',
                  owner_id: user?.id,
                },
              ])
              .select()
              .single()

            if (viewError) {
              // If it's a duplicate key error, try next name (race condition occurred)
              if (viewError.code === '23505' && (viewError.message?.includes('idx_views_table_name') || viewError.message?.includes('idx_views_group_name'))) {
                viewName = `${baseViewName} (${counter})`
                counter++
                continue // Retry with new name
              } else {
                // Other error - throw it
                throw new Error(`Failed to create view: ${viewError.message || 'Unknown error'}`)
              }
            } else if (newView) {
              recordView = newView
              viewCreated = true
            }
          } else {
            // Name exists, try next name
            viewName = `${baseViewName} (${counter})`
            counter++
          }
        }

        if (!viewCreated || !recordView) {
          throw new Error(`Failed to create view: Could not generate unique view name after ${counter} attempts`)
        }

        saved_view_id = recordView.id
      }

      // Content pages use dashboard_layout_id (self-reference for blocks)
      if (pageType === 'content') {
        // Generate a temporary UUID that we'll update to the page's ID after creation
        dashboard_layout_id = crypto.randomUUID()
      }

      // Create interface page in interface_pages table
      const { data: page, error } = await supabase
        .from('interface_pages')
        .insert([
          {
            name: pageName.trim(),
            page_type: pageType,
            base_table: base_table, // Store table selection
            saved_view_id,
            dashboard_layout_id,
            form_config_id,
            record_config_id,
            group_id: selectedInterfaceId && selectedInterfaceId.trim() ? selectedInterfaceId.trim() : null, // Required
            config: {},
            created_by: user?.id,
          },
        ])
        .select()
        .single()

      if (error) throw error

      // For content pages, update dashboard_layout_id to the page's own ID (self-reference)
      // This allows the page to reference its own blocks in view_blocks table
      if (pageType === 'content' && page) {
        const { error: updateError } = await supabase
          .from('interface_pages')
          .update({ dashboard_layout_id: page.id })
          .eq('id', page.id)
        
        if (updateError) {
          console.error('Error updating dashboard_layout_id:', updateError)
          throw updateError // Throw error since this is required for content pages
        }
      }
      
      // For record_view pages, optionally update dashboard_layout_id if we want blocks
      if (pageType === 'record_view' && page) {
        const { error: updateError } = await supabase
          .from('interface_pages')
          .update({ dashboard_layout_id: page.id })
          .eq('id', page.id)
        
        if (updateError) {
          console.error('Error updating dashboard_layout_id:', updateError)
          // Don't throw - record_view pages can work without dashboard_layout_id
        }

        // Seed two-column layout blocks for record_view pages
        if (tableId && tableId.trim()) {
          try {
            const layoutBlocks = createRecordReviewTwoColumnLayout({
              primaryTableId: tableId.trim(),
              mode: 'review',
            })

            // Create blocks sequentially via API (POST endpoint creates one block at a time)
            for (const blockDef of layoutBlocks) {
              try {
                const blockResponse = await fetch(`/api/pages/${page.id}/blocks`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: blockDef.type,
                    x: blockDef.x,
                    y: blockDef.y,
                    w: blockDef.w,
                    h: blockDef.h,
                    config: blockDef.config,
                  }),
                })

                if (!blockResponse.ok) {
                  console.error(`Error creating block ${blockDef.type}:`, await blockResponse.text())
                  // Continue with next block
                }
              } catch (blockError) {
                console.error(`Error creating block ${blockDef.type}:`, blockError)
                // Continue with next block
              }
            }
          } catch (layoutError) {
            console.error('Error seeding two-column layout blocks:', layoutError)
            // Continue anyway - blocks can be added manually
          }
        }
      }

      // Reset and close
      setStep('interface')
      setSelectedInterfaceId('')
      setPagePurpose('content')
      setPageType('')
      setTableId('')
      setPageName('')
      setCreating(false)
      onOpenChange(false)

      // Redirect to new page
      router.push(`/pages/${page.id}`)
    } catch (error: any) {
      console.error('Error creating page:', error)
      alert(error.message || 'Failed to create page')
      setCreating(false)
    }
  }

  const renderInterfaceStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select Interface *</Label>
        <p className="text-sm text-gray-500 mb-2">
          Every page must belong to an Interface. Interfaces are containers that group related pages together.
        </p>
        <Select value={selectedInterfaceId} onValueChange={setSelectedInterfaceId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an Interface" />
          </SelectTrigger>
          <SelectContent>
            {interfaceGroups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {interfaceGroups.length === 0 && (
          <p className="text-sm text-gray-500">
            No interfaces found. Create an Interface first in Settings → Interface Access & Sharing.
          </p>
        )}
      </div>
      <Button
        onClick={handleInterfaceSelect}
        disabled={!selectedInterfaceId}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  )

  const renderPurposeStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handlePurposeSelect('content')}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <BookOpen className="h-6 w-6 mb-2 text-gray-600" />
          <h3 className="font-semibold">Content Page</h3>
          <p className="text-sm text-gray-500">Docs, links, resources, information</p>
        </button>
        <button
          onClick={() => handlePurposeSelect('record')}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <FileCheck className="h-6 w-6 mb-2 text-gray-600" />
          <h3 className="font-semibold">Record Review</h3>
          <p className="text-sm text-gray-500">Browse & Review Records</p>
        </button>
      </div>
    </div>
  )

  const renderAnchorStep = () => {
    const isRecordPage = pageType ? isRecordViewPage(pageType as PageType) : false

    // Record View pages: Only show table selection (optional - blocks define their own data sources)
    if (isRecordPage) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Table (Optional)</Label>
            <p className="text-sm text-gray-500 mb-2">
              This page will show records. Select a table to provide context for blocks. Blocks can define their own data sources.
            </p>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tables.length === 0 && (
              <p className="text-sm text-gray-500">No tables available. Create a table first in Settings → Data.</p>
            )}
          </div>
          <Button
            onClick={handleAnchorConfigured}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      )
    }

    // Only record_view pages reach this step (content pages skip to name step)
    // This should not be reached for other page types

    return null
  }

  const renderNameStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="page-name">Page Name *</Label>
        <Input
          id="page-name"
          value={pageName}
          onChange={(e) => setPageName(e.target.value)}
          placeholder="My Page"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pageName.trim() && !creating) {
              handleCreate()
            }
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={() => {
            // For content pages, go back to purpose (skipped anchor step)
            // For other pages, go back to anchor
            if (pageType === 'content') {
              setStep('purpose')
            } else {
              setStep('anchor')
            }
          }} 
          className="flex-1"
        >
          Back
        </Button>
        <Button onClick={handleCreate} disabled={creating || !pageName.trim() || !selectedInterfaceId} className="flex-1">
          {creating ? 'Creating...' : 'Create Page'}
        </Button>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'interface' && 'Select Interface'}
            {step === 'purpose' && 'Create New Page'}
            {step === 'anchor' && (isRecordViewPage(pageType as PageType) ? 'Create Record View Page' : 'Configure Page')}
            {step === 'name' && 'Name Your Page'}
          </DialogTitle>
          <DialogDescription>
            {step === 'interface' && 'Choose which Interface this page belongs to'}
            {step === 'purpose' && 'Choose what this page will do'}
            {step === 'anchor' && (isRecordViewPage(pageType as PageType) ? 'Select a table to provide context for blocks (optional)' : 'Set up the data source or layout')}
            {step === 'name' && 'Give your page a name'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {step === 'interface' && renderInterfaceStep()}
          {step === 'purpose' && renderPurposeStep()}
          {step === 'anchor' && renderAnchorStep()}
          {step === 'name' && renderNameStep()}
        </div>
        {step === 'interface' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        )}
        {step === 'purpose' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep('interface')}>
              Back
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

