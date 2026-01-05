"use client"

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
import { Database, LayoutDashboard, FileText, FileCheck } from "lucide-react"

interface PageCreationWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultGroupId?: string | null
}

type WizardStep = 'purpose' | 'anchor' | 'name'

export default function PageCreationWizard({
  open,
  onOpenChange,
  defaultGroupId,
}: PageCreationWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>('purpose')
  const [pagePurpose, setPagePurpose] = useState<'view' | 'dashboard' | 'form' | 'record'>('view')
  const [pageType, setPageType] = useState<PageType | ''>('')
  const [savedViewId, setSavedViewId] = useState<string>('')
  const [tableId, setTableId] = useState<string>('')
  const [pageName, setPageName] = useState('')
  const [creating, setCreating] = useState(false)
  const [views, setViews] = useState<Array<{ id: string; name: string; table_id: string | null }>>([])
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadViews()
      loadTables()
      // Reset state
      setStep('purpose')
      setPagePurpose('view')
      setPageType('')
      setSavedViewId('')
      setTableId('')
      setPageName('')
    }
  }, [open])

  async function loadViews() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('views')
        .select('id, name, table_id, type')
        .in('type', ['grid', 'kanban', 'calendar', 'gallery'])
        .order('name')

      if (!error && data) {
        setViews(data)
      }
    } catch (error) {
      console.error('Error loading views:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handlePurposeSelect = (purpose: 'view' | 'dashboard' | 'form' | 'record') => {
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

    const requiredAnchor = getRequiredAnchorType(pageType as PageType)
    
    // Validate anchor is set
    if (requiredAnchor === 'saved_view' && !savedViewId) {
      alert('Please select a saved view')
      return
    }
    if (requiredAnchor === 'form' && !tableId) {
      alert('Please select a table for the form')
      return
    }

    setCreating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Prepare anchor fields
      // Convert empty strings to null for UUID fields
      let saved_view_id: string | null = null
      let dashboard_layout_id: string | null = null
      let form_config_id: string | null = null
      let record_config_id: string | null = null

      switch (requiredAnchor) {
        case 'saved_view':
          saved_view_id = savedViewId && savedViewId.trim() ? savedViewId.trim() : null
          break
        case 'dashboard':
          // For dashboard, we'll set it to null initially
          // The actual layout_id will be set to the page's own ID after creation
          dashboard_layout_id = null
          break
        case 'form':
          form_config_id = tableId && tableId.trim() ? tableId.trim() : null
          break
        case 'record':
          record_config_id = savedViewId && savedViewId.trim() ? savedViewId.trim() : null
          break
      }

      // Create interface page in interface_pages table
      const { data: page, error } = await supabase
        .from('interface_pages')
        .insert([
          {
            name: pageName.trim(),
            page_type: pageType,
            saved_view_id,
            dashboard_layout_id,
            form_config_id,
            record_config_id,
            group_id: defaultGroupId && defaultGroupId.trim() ? defaultGroupId.trim() : null,
            config: {},
            created_by: user?.id,
          },
        ])
        .select()
        .single()

      if (error) throw error

      // For dashboard/overview pages, set dashboard_layout_id to the page's own ID (self-reference)
      // This allows the page to reference its own blocks in view_blocks table
      if ((requiredAnchor === 'dashboard' || pageType === 'overview') && page) {
        const { error: updateError } = await supabase
          .from('interface_pages')
          .update({ dashboard_layout_id: page.id })
          .eq('id', page.id)
        
        if (updateError) {
          console.error('Error updating dashboard_layout_id:', updateError)
          // Don't throw - page was created successfully, this is just metadata
        }
      }

      // Reset and close
      setStep('purpose')
      setPagePurpose('view')
      setPageType('')
      setSavedViewId('')
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
      </div>
    </div>
  )

  const renderAnchorStep = () => {
    const requiredAnchor = pageType ? getRequiredAnchorType(pageType as PageType) : null

    if (requiredAnchor === 'saved_view') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Page Type</Label>
            <Select value={pageType} onValueChange={(value) => setPageType(value as PageType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="gallery">Gallery</SelectItem>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="calendar">Calendar</SelectItem>
                <SelectItem value="timeline">Timeline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Select Saved View *</Label>
            <Select value={savedViewId} onValueChange={setSavedViewId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a view" />
              </SelectTrigger>
              <SelectContent>
                {views.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name} {view.table_id ? `(${tables.find(t => t.id === view.table_id)?.name || ''})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {views.length === 0 && (
              <p className="text-sm text-gray-500">No views available. Create a view first.</p>
            )}
          </div>
          <Button
            onClick={handleAnchorConfigured}
            disabled={!savedViewId || !pageType}
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
        <Button variant="outline" onClick={() => setStep('anchor')} className="flex-1">
          Back
        </Button>
        <Button onClick={handleCreate} disabled={creating || !pageName.trim()} className="flex-1">
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
            {step === 'purpose' && 'Create New Page'}
            {step === 'anchor' && 'Configure Page'}
            {step === 'name' && 'Name Your Page'}
          </DialogTitle>
          <DialogDescription>
            {step === 'purpose' && 'Choose what this page will do'}
            {step === 'anchor' && 'Set up the data source or layout'}
            {step === 'name' && 'Give your page a name'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {step === 'purpose' && renderPurposeStep()}
          {step === 'anchor' && renderAnchorStep()}
          {step === 'name' && renderNameStep()}
        </div>
        {step === 'purpose' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

