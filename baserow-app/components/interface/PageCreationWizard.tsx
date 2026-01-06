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
import { PageType, PAGE_TYPE_DEFINITIONS, getRequiredAnchorType } from "@/lib/interface/page-types"
import { Database, LayoutDashboard, FileText, FileCheck, BookOpen } from "lucide-react"

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
  const [pagePurpose, setPagePurpose] = useState<'view' | 'dashboard' | 'form' | 'record' | 'content'>('view')
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
      setPagePurpose('view')
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

  const handlePurposeSelect = (purpose: 'view' | 'dashboard' | 'form' | 'record' | 'content') => {
    setPagePurpose(purpose)
    
    // Auto-select default page type for purpose
    switch (purpose) {
      case 'view':
        setPageType('list')
        break
      case 'dashboard':
        setPageType('dashboard')
        break
      case 'form':
        setPageType('form')
        break
      case 'record':
        setPageType('record_review')
        break
      case 'content':
        setPageType('content')
        // Skip anchor step for content pages - go directly to name
        setStep('name')
        return
    }
    
    setStep('anchor')
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

    const requiredAnchor = getRequiredAnchorType(pageType as PageType)
    
    // Content pages don't require table/view
    if (pageType === 'content') {
      // Skip validation - content pages don't need data sources
    } else {
      // Validate anchor is set - users select tables, not views
      if ((requiredAnchor === 'saved_view' || requiredAnchor === 'record') && !tableId) {
        alert('Please select a table')
        return
      }
      if (requiredAnchor === 'form' && !tableId) {
        alert('Please select a table for the form')
        return
      }
    }

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

      // All page types that need data use base_table
      // SQL views will be auto-generated from base_table if needed
      // Content pages don't use base_table
      if (tableId && tableId.trim() && pageType !== 'content') {
        base_table = tableId.trim()
      }

      // Content pages use dashboard anchor but don't require data
      if (pageType === 'content') {
        // Generate a temporary UUID that we'll update to the page's ID after creation
        dashboard_layout_id = crypto.randomUUID()
      } else {
        switch (requiredAnchor) {
        case 'saved_view':
          // For saved_view anchor, create a view first
          // Map page_type to view type
          const viewTypeMap: Record<string, 'grid' | 'gallery' | 'kanban' | 'calendar' | 'timeline'> = {
            'list': 'grid',
            'gallery': 'gallery',
            'kanban': 'kanban',
            'calendar': 'calendar',
            'timeline': 'timeline',
            'record_review': 'grid', // record_review uses grid view
          }
          const viewType = viewTypeMap[pageType] || 'grid'
          
          // Create a view for this page
          const { data: newView, error: viewError } = await supabase
            .from('views')
            .insert([
              {
                table_id: tableId,
                name: `${pageName.trim()} View`,
                type: viewType,
                config: {},
                access_level: 'authenticated',
                owner_id: user?.id,
              },
            ])
            .select()
            .single()

          if (viewError || !newView) {
            throw new Error(`Failed to create view: ${viewError?.message || 'Unknown error'}`)
          }

          saved_view_id = newView.id
          break
        case 'dashboard':
          // For dashboard, generate a temporary UUID that we'll update to the page's ID after creation
          // This satisfies the constraint that requires exactly one anchor
          // We'll update it immediately after page creation
          dashboard_layout_id = crypto.randomUUID()
          break
        case 'form':
          form_config_id = tableId && tableId.trim() ? tableId.trim() : null
          break
        case 'record':
          // Record review pages use saved_view anchor (not record anchor)
          // This case should not be hit since record_review maps to 'saved_view' anchor
          // But keeping it for safety - create a view
          const { data: recordView, error: recordViewError } = await supabase
            .from('views')
            .insert([
              {
                table_id: tableId,
                name: `${pageName.trim()} View`,
                type: 'grid',
                config: {},
                access_level: 'authenticated',
                owner_id: user?.id,
              },
            ])
            .select()
            .single()

          if (recordViewError || !recordView) {
            throw new Error(`Failed to create view: ${recordViewError?.message || 'Unknown error'}`)
          }

          saved_view_id = recordView.id
          break
        }
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

      // For dashboard/overview/content pages, update dashboard_layout_id to the page's own ID (self-reference)
      // This allows the page to reference its own blocks in view_blocks table
      if ((requiredAnchor === 'dashboard' || pageType === 'overview' || pageType === 'content') && page) {
        const { error: updateError } = await supabase
          .from('interface_pages')
          .update({ dashboard_layout_id: page.id })
          .eq('id', page.id)
        
        if (updateError) {
          console.error('Error updating dashboard_layout_id:', updateError)
          throw updateError // Throw error since this is required for dashboard/content pages
        }
      }

      // Reset and close
      setStep('interface')
      setSelectedInterfaceId('')
      setPagePurpose('view')
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
          onClick={() => handlePurposeSelect('view')}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <Database className="h-6 w-6 mb-2 text-gray-600" />
          <h3 className="font-semibold">View Data</h3>
          <p className="text-sm text-gray-500">List, Gallery, Kanban, Calendar, Timeline</p>
        </button>
        <button
          onClick={() => handlePurposeSelect('dashboard')}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <LayoutDashboard className="h-6 w-6 mb-2 text-gray-600" />
          <h3 className="font-semibold">Dashboard</h3>
          <p className="text-sm text-gray-500">KPIs, Charts, Metrics</p>
        </button>
        <button
          onClick={() => handlePurposeSelect('form')}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <FileText className="h-6 w-6 mb-2 text-gray-600" />
          <h3 className="font-semibold">Form</h3>
          <p className="text-sm text-gray-500">Collect Data</p>
        </button>
        <button
          onClick={() => handlePurposeSelect('record')}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <FileCheck className="h-6 w-6 mb-2 text-gray-600" />
          <h3 className="font-semibold">Record Review</h3>
          <p className="text-sm text-gray-500">Browse & Review Records</p>
        </button>
        <button
          onClick={() => handlePurposeSelect('content')}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left transition-colors"
        >
          <BookOpen className="h-6 w-6 mb-2 text-gray-600" />
          <h3 className="font-semibold">Content Page</h3>
          <p className="text-sm text-gray-500">Docs, links, resources, information</p>
        </button>
      </div>
    </div>
  )

  const renderAnchorStep = () => {
    const requiredAnchor = pageType ? getRequiredAnchorType(pageType as PageType) : null

    if (requiredAnchor === 'saved_view' || requiredAnchor === 'record') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Page Type</Label>
            <Select value={pageType} onValueChange={(value) => setPageType(value as PageType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {requiredAnchor === 'saved_view' && (
                  <>
                    <SelectItem value="list">List</SelectItem>
                    <SelectItem value="gallery">Gallery</SelectItem>
                    <SelectItem value="kanban">Kanban</SelectItem>
                    <SelectItem value="calendar">Calendar</SelectItem>
                    <SelectItem value="timeline">Timeline</SelectItem>
                  </>
                )}
                {requiredAnchor === 'record' && (
                  <SelectItem value="record_review">Record Review</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Select Table *</Label>
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
            <p className="text-xs text-gray-500">
              SQL views are created automatically from the selected table
            </p>
            {tables.length === 0 && (
              <p className="text-sm text-gray-500">No tables available. Create a table first in Settings → Data.</p>
            )}
          </div>
          <Button
            onClick={handleAnchorConfigured}
            disabled={!tableId || !pageType}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      )
    }

    if (requiredAnchor === 'form') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Table *</Label>
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
          </div>
          <Button
            onClick={handleAnchorConfigured}
            disabled={!tableId}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      )
    }

    if (requiredAnchor === 'dashboard') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Dashboard pages start empty. You&apos;ll add blocks after creation.
          </p>
          <Button
            onClick={handleAnchorConfigured}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      )
    }

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
            {step === 'anchor' && 'Configure Page'}
            {step === 'name' && 'Name Your Page'}
          </DialogTitle>
          <DialogDescription>
            {step === 'interface' && 'Choose which Interface this page belongs to'}
            {step === 'purpose' && 'Choose what this page will do'}
            {step === 'anchor' && 'Set up the data source or layout'}
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

