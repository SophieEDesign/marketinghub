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
import FieldPickerModal from "./FieldPickerModal"

interface PageCreationWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultGroupId?: string | null
}

type WizardStep = 'interface' | 'purpose' | 'anchor' | 'fields' | 'name'

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
  const [selectedFields, setSelectedFields] = useState<string[]>([]) // Fields selected for structured field list
  const [fieldsAsBlocks, setFieldsAsBlocks] = useState<string[]>([]) // Fields to add as blocks
  const [leftPanelFilter, setLeftPanelFilter] = useState<string>('')
  const [leftPanelFilterOperator, setLeftPanelFilterOperator] = useState<string>('equal')
  const [leftPanelFilterValue, setLeftPanelFilterValue] = useState<string>('')
  const [leftPanelSort, setLeftPanelSort] = useState<string>('')
  const [leftPanelSortDirection, setLeftPanelSortDirection] = useState<'asc' | 'desc'>('asc')
  const [leftPanelGroup, setLeftPanelGroup] = useState<string>('')
  const [tableFields, setTableFields] = useState<Array<{ id: string; name: string; type: string; options?: any }>>([])
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
      setSelectedFields([])
      setFieldsAsBlocks([])
      setLeftPanelFilter('')
      setLeftPanelFilterOperator('equal')
      setLeftPanelFilterValue('')
      setLeftPanelSort('')
      setLeftPanelSortDirection('asc')
      setLeftPanelGroup('')
      setTableFields([])
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

  async function loadTableFields() {
    if (!tableId) {
      setTableFields([])
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('table_fields')
        .select('id, name, type, options')
        .eq('table_id', tableId)
        .order('position', { ascending: true })

      if (!error && data) {
        setTableFields(data)
      } else {
        console.error('Error loading table fields:', error)
        setTableFields([])
      }
    } catch (error) {
      console.error('Error loading table fields:', error)
      setTableFields([])
    }
  }

  useEffect(() => {
    if (tableId && pageType === 'record_view') {
      loadTableFields()
    }
  }, [tableId, pageType])

  // Get appropriate operators for a field type
  function getOperatorsForFieldType(fieldType: string) {
    switch (fieldType) {
      case "text":
      case "long_text":
        return [
          { value: "contains", label: "Contains" },
          { value: "not_contains", label: "Does not contain" },
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "number":
      case "currency":
      case "percent":
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "greater_than", label: "Greater than" },
          { value: "greater_than_or_equal", label: "Greater than or equal" },
          { value: "less_than", label: "Less than" },
          { value: "less_than_or_equal", label: "Less than or equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "date":
        return [
          { value: "date_equal", label: "Is" },
          { value: "date_before", label: "Before" },
          { value: "date_after", label: "After" },
          { value: "date_on_or_before", label: "On or before" },
          { value: "date_on_or_after", label: "On or after" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "single_select":
      case "multi_select":
        return [
          { value: "equal", label: "Is" },
          { value: "not_equal", label: "Is not" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
      case "checkbox":
        return [
          { value: "equal", label: "Is checked" },
          { value: "not_equal", label: "Is unchecked" },
        ]
      default:
        return [
          { value: "equal", label: "Equals" },
          { value: "not_equal", label: "Does not equal" },
          { value: "is_empty", label: "Is empty" },
          { value: "is_not_empty", label: "Is not empty" },
        ]
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
    // Validate table is required for record_view pages
    if (pageType === 'record_view' && (!tableId || !tableId.trim())) {
      alert('Please select a table. The table is required to display records in the left column.')
      return
    }
    // For record_view pages, show field picker step
    if (pageType === 'record_view') {
      setStep('fields')
    } else {
      setStep('name')
    }
  }

  const handleFieldsSelectedAndContinue = (fieldNames: string[]) => {
    setSelectedFields(fieldNames)
    setStep('name')
  }

  const handleAddFieldsAsBlocks = (fieldNames: string[]) => {
    setFieldsAsBlocks(fieldNames)
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
    // Record view pages REQUIRE a table for the left column record list
    // Content pages don't require any data sources
    
    // Validate table is required for record_view pages
    if (pageType === 'record_view' && (!tableId || !tableId.trim())) {
      alert('Please select a table for the Record View page. The table is required to display records in the left column.')
      setCreating(false)
      return
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

      // Unified architecture: Pages don't require anchors
      // Blocks define their own data sources
      // Required: Store base_table for record_view pages (for left column record list)
      if (pageType === 'record_view') {
        if (!tableId || !tableId.trim()) {
          throw new Error('Table is required for Record View pages')
        }
        base_table = tableId.trim()
        
        // Create a grid view for data access (required for record_view pages)
        // This view is used internally and appears in Core Data
        // Note: The view name pattern is intentional - it helps identify which view belongs to which page
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
      // For record_view pages, store tableId in both base_table and config.tableId
      // Also store selected fields in config.visible_fields
      // Store left panel settings (filter, sort, group) in config.left_panel
      // Default title_field to "name" if available, otherwise first column (excluding ID)
      const nameField = tableFields.find(f => f.name.toLowerCase() === 'name')
      // Skip ID field and use first non-ID field
      const firstNonIdField = tableFields.find(f => f.name.toLowerCase() !== 'id')
      const defaultTitleField = nameField?.name || firstNonIdField?.name || undefined
      
      const pageConfig = pageType === 'record_view' && base_table
        ? {
            tableId: base_table,
            visible_fields: selectedFields.length > 0 ? selectedFields : undefined,
            title_field: defaultTitleField,
            left_panel: {
              ...(leftPanelFilter ? {
                filter_by: [{
                  field: leftPanelFilter,
                  operator: leftPanelFilterOperator as any,
                  value: leftPanelFilterValue
                }]
              } : {}),
              ...(leftPanelSort ? {
                sort_by: [{
                  field: leftPanelSort,
                  direction: leftPanelSortDirection
                }]
              } : {}),
              ...(leftPanelGroup ? {
                group_by: leftPanelGroup
              } : {}),
              // Default title field to "name" if available
              title_field: defaultTitleField,
            }
          }
        : {}
      
      // Generate unique page name to avoid duplicate key errors
      // The constraint idx_interface_pages_group_name requires unique (group_id, name)
      const basePageName = pageName.trim()
      let finalPageName = basePageName
      let counter = 1
      let page: any = null
      let pageCreated = false
      const maxAttempts = 100 // Safety limit
      
      // Try to create page with retry logic for duplicate names
      while (!pageCreated && counter <= maxAttempts) {
        // Check if page name already exists in the same group
        const { data: existingPages } = await supabase
          .from('interface_pages')
          .select('id')
          .eq('group_id', selectedInterfaceId && selectedInterfaceId.trim() ? selectedInterfaceId.trim() : null)
          .eq('name', finalPageName)
          .is('is_archived', false)
          .limit(1)
        
        // If name doesn't exist, try to create it
        if (!existingPages || existingPages.length === 0) {
          const { data: newPage, error: pageError } = await supabase
            .from('interface_pages')
            .insert([
              {
                name: finalPageName,
                page_type: pageType,
                base_table: base_table, // Store table selection
                saved_view_id,
                dashboard_layout_id,
                form_config_id,
                record_config_id,
                group_id: selectedInterfaceId && selectedInterfaceId.trim() ? selectedInterfaceId.trim() : null, // Required
                config: pageConfig, // Store tableId in config for record_view pages
                created_by: user?.id,
              },
            ])
            .select()
            .single()

          if (pageError) {
            // If it's a duplicate key error, try next name (race condition occurred)
            if (pageError.code === '23505' && pageError.message?.includes('idx_interface_pages_group_name')) {
              finalPageName = `${basePageName} (${counter})`
              counter++
              continue // Retry with new name
            } else {
              // Other error - throw it
              throw new Error(`Failed to create page: ${pageError.message || 'Unknown error'}`)
            }
          } else if (newPage) {
            page = newPage
            pageCreated = true
          }
        } else {
          // Name exists, try next name
          finalPageName = `${basePageName} (${counter})`
          counter++
        }
      }

      if (!pageCreated || !page) {
        throw new Error(`Failed to create page: Could not generate unique page name after ${counter} attempts`)
      }

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
      
      // For record_view pages, create blocks (left panel grid + field blocks for selected fields)
      // Note: record_view pages use saved_view_id as their anchor, not dashboard_layout_id
      // Blocks are stored via page_id in view_blocks table, so dashboard_layout_id is not needed
      if (pageType === 'record_view' && page) {
        if (tableId && tableId.trim()) {
          try {
            // Create left panel grid block (record list)
            const layoutBlocks = createRecordReviewTwoColumnLayout({
              primaryTableId: tableId.trim(),
              mode: 'review',
            })

            // Create default layout blocks sequentially via API (left panel grid)
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
                }
              } catch (blockError) {
                console.error(`Error creating block ${blockDef.type}:`, blockError)
              }
            }

            // Create field blocks for ALL selected fields (not just fieldsAsBlocks)
            // These are placed in the right column (x=4)
            // Priority: selectedFields (from field picker) > fieldsAsBlocks (if no selectedFields)
            const fieldsToCreateAsBlocks = selectedFields.length > 0 ? selectedFields : fieldsAsBlocks
            
            if (fieldsToCreateAsBlocks.length > 0) {
              let yOffset = 0 // Start at top of right column
              for (const fieldName of fieldsToCreateAsBlocks) {
                const field = tableFields.find(f => f.name === fieldName)
                if (field) {
                  try {
                    const blockResponse = await fetch(`/api/pages/${page.id}/blocks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'field',
                        x: 4, // Right column
                        y: yOffset,
                        w: 8, // Full right column width
                        h: 2, // Default height for field blocks
                        config: {
                          title: field.name,
                          table_id: tableId.trim(),
                          field_id: field.id,
                          field_name: field.name,
                          // Enable inline editing if page is editable
                          allow_inline_edit: true,
                          inline_edit_permission: 'both', // Can be configured per field later
                        },
                      }),
                    })

                    if (!blockResponse.ok) {
                      console.error(`Error creating field block ${fieldName}:`, await blockResponse.text())
                    } else {
                      yOffset += 2 // Move down for next block
                    }
                  } catch (blockError) {
                    console.error(`Error creating field block ${fieldName}:`, blockError)
                  }
                }
              }
            }
          } catch (layoutError) {
            console.error('Error seeding blocks:', layoutError)
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
      setSelectedFields([])
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

    // Record View pages: Show table selection with filter/sort/group options
    if (isRecordPage) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Table *</Label>
            <p className="text-sm text-gray-500 mb-2">
              Connect your layout to a table. Apply filters, sorts, and groups to further refine your layout.
            </p>
            <Select value={tableId} onValueChange={setTableId} required>
              <SelectTrigger>
                <SelectValue placeholder="Choose a table (required)" />
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
              <p className="text-sm text-red-500">No tables available. Create a table first in Settings → Data.</p>
            )}
            {!tableId && tables.length > 0 && (
              <p className="text-sm text-red-500">Please select a table to continue.</p>
            )}
          </div>

          {/* Data Options */}
          {tableId && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data Options</Label>
                <p className="text-xs text-gray-500">
                  Configure filters, sorting, and grouping for the record list. Select a field to filter by to see filter options.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Filter By</Label>
                    <Select value={leftPanelFilter || "__none__"} onValueChange={(value) => {
                      const newField = value === "__none__" ? "" : value
                      setLeftPanelFilter(newField)
                      // Reset filter operator and value when field changes
                      if (newField !== leftPanelFilter) {
                        const selectedField = tableFields.find(f => f.name === newField)
                        const operators = selectedField 
                          ? getOperatorsForFieldType(selectedField.type)
                          : getOperatorsForFieldType('text')
                        // Set to first available operator for the field type
                        setLeftPanelFilterOperator(operators[0]?.value || 'equal')
                        setLeftPanelFilterValue('')
                      }
                    }}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {tableFields.length === 0 ? (
                          <SelectItem value="__loading__" disabled>Loading fields...</SelectItem>
                        ) : (
                          tableFields.map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {field.name} {field.type === 'single_select' || field.type === 'multi_select' ? '(Select)' : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Sort</Label>
                    <Select value={leftPanelSort || "__none__"} onValueChange={(value) => setLeftPanelSort(value === "__none__" ? "" : value)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {tableFields.map((field) => (
                          <SelectItem key={field.id} value={field.name}>
                            {field.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Group</Label>
                    <Select value={leftPanelGroup || "__none__"} onValueChange={(value) => setLeftPanelGroup(value === "__none__" ? "" : value)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {tableFields
                          .filter(f => f.type === 'single_select' || f.type === 'multi_select')
                          .map((field) => (
                            <SelectItem key={field.id} value={field.name}>
                              {field.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {leftPanelFilter && (
                  <div className="pt-3 space-y-3 border-t bg-gray-50 p-3 rounded-md">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-700">Filter Configuration</Label>
                      <p className="text-xs text-gray-500">Configure how to filter by &quot;{leftPanelFilter}&quot;</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-600">Operator</Label>
                        {(() => {
                          const selectedFilterField = tableFields.find(f => f.name === leftPanelFilter)
                          const operators = selectedFilterField 
                            ? getOperatorsForFieldType(selectedFilterField.type)
                            : getOperatorsForFieldType('text')
                          
                          return (
                            <Select 
                              value={leftPanelFilterOperator} 
                              onValueChange={(value) => {
                                setLeftPanelFilterOperator(value)
                                // Reset value when operator changes to empty operators
                                if (['is_empty', 'is_not_empty'].includes(value)) {
                                  setLeftPanelFilterValue('')
                                }
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {operators.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        })()}
                      </div>
                      {!['is_empty', 'is_not_empty'].includes(leftPanelFilterOperator) && (
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Value</Label>
                          {(() => {
                            const selectedFilterField = tableFields.find(f => f.name === leftPanelFilter)
                            const isSelectField = selectedFilterField && 
                              (selectedFilterField.type === 'single_select' || selectedFilterField.type === 'multi_select') &&
                              selectedFilterField.options?.choices &&
                              Array.isArray(selectedFilterField.options.choices) &&
                              selectedFilterField.options.choices.length > 0
                            
                            if (isSelectField) {
                              return (
                                <Select value={leftPanelFilterValue} onValueChange={setLeftPanelFilterValue}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder={`Select ${selectedFilterField.name} value`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedFilterField.options.choices.map((choice: string) => (
                                      <SelectItem key={choice} value={choice}>
                                        {choice}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )
                            }
                            
                            // Determine input type based on field type
                            const inputType = selectedFilterField?.type === 'number' || 
                                            selectedFilterField?.type === 'currency' || 
                                            selectedFilterField?.type === 'percent'
                              ? 'number'
                              : selectedFilterField?.type === 'date'
                              ? 'date'
                              : 'text'
                            
                            return (
                              <Input
                                type={inputType}
                                value={leftPanelFilterValue}
                                onChange={(e) => setLeftPanelFilterValue(e.target.value)}
                                placeholder="Enter filter value"
                                className="h-9"
                              />
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {leftPanelSort && (
                  <div className="pt-1">
                    <Select value={leftPanelSortDirection} onValueChange={(value: 'asc' | 'desc') => setLeftPanelSortDirection(value)}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep('purpose')} className="flex-1">
              Back
            </Button>
            <Button
              onClick={handleAnchorConfigured}
              disabled={!tableId}
              className="flex-1"
            >
              Next
            </Button>
          </div>
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

  // Render FieldPickerModal as a separate dialog when on fields step
  if (step === 'fields') {
    return (
      <FieldPickerModal
        open={open && step === 'fields'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            // Use functional setState to check current step value
            // If step is still 'fields', it means modal was cancelled (not saved)
            // If step changed to 'name', handleFieldsSelectedAndContinue was called, so don't revert
            setStep((currentStep) => {
              return currentStep === 'fields' ? 'anchor' : currentStep
            })
          }
        }}
        tableId={tableId}
        selectedFields={selectedFields}
        onFieldsChange={handleFieldsSelectedAndContinue}
        onAddAsBlocks={handleAddFieldsAsBlocks}
      />
    )
  }

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
            {step === 'anchor' && (isRecordViewPage(pageType as PageType) ? 'Connect to a table' : 'Set up the data source or layout')}
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
        {step === 'name' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                // For record_view pages, go back to fields step
                // For content pages, go back to purpose
                if (pageType === 'record_view') {
                  setStep('fields')
                } else {
                  setStep('purpose')
                }
              }}
            >
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

