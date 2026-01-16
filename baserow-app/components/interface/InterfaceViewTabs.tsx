"use client"

import { useState, useEffect } from "react"
import { Plus, X, GripVertical } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { VIEWS_ENABLED } from "@/lib/featureFlags"

interface InterfaceViewTab {
  id: string
  interface_id: string
  view_id: string
  name: string
  position: number
}

interface View {
  id: string
  name: string
  type: string
  table_id: string | null
}

interface InterfaceViewTabsProps {
  pageId: string
  activeViewId: string | null
  onViewChange: (viewId: string | null) => void
  isEditing: boolean
}

export default function InterfaceViewTabs({
  pageId,
  activeViewId,
  onViewChange,
  isEditing,
}: InterfaceViewTabsProps) {
  // RULE: Views are currently not used; never render this UI unless explicitly enabled.
  if (!VIEWS_ENABLED) {
    return null
  }

  const { toast } = useToast()
  const [tabs, setTabs] = useState<InterfaceViewTab[]>([])
  const [availableViews, setAvailableViews] = useState<View[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTabName, setNewTabName] = useState("")
  const [selectedViewId, setSelectedViewId] = useState<string>("")

  useEffect(() => {
    loadTabs()
    loadAvailableViews()
  }, [pageId])

  async function loadTabs() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('interface_views')
        .select('*')
        .eq('interface_id', pageId)
        .order('position', { ascending: true })

      if (error && error.code !== 'PGRST116' && !error.message?.includes('does not exist')) {
        console.error('Error loading tabs:', error)
        return
      }

      const interfaceViews = (data || []) as InterfaceViewTab[]
      
      // Load view names
      if (interfaceViews.length > 0) {
        const viewIds = interfaceViews.map(tab => tab.view_id)
        const { data: viewsData } = await supabase
          .from('views')
          .select('id, name')
          .in('id', viewIds)

        const viewsMap = new Map((viewsData || []).map(v => [v.id, v.name]))
        const tabsWithNames = interfaceViews.map(tab => ({
          ...tab,
          name: viewsMap.get(tab.view_id) || tab.name || 'Untitled',
        }))
        
        setTabs(tabsWithNames)
        
        // Set first tab as active if none selected
        if (!activeViewId && tabsWithNames.length > 0) {
          onViewChange(tabsWithNames[0].view_id)
        }
      } else {
        setTabs([])
      }
    } catch (error) {
      console.error('Error loading tabs:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadAvailableViews() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('views')
        .select('id, name, type, table_id')
        .neq('type', 'interface')
        .order('name', { ascending: true })

      if (!error && data) {
        setAvailableViews(data as View[])
      }
    } catch (error) {
      console.error('Error loading available views:', error)
    }
  }

  async function handleAddTab() {
    if (!newTabName.trim() || !selectedViewId) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please provide both a name and select a view",
      })
      return
    }

    try {
      const supabase = createClient()
      
      // Get max position
      const { data: existingTabs } = await supabase
        .from('interface_views')
        .select('position')
        .eq('interface_id', pageId)
        .order('position', { ascending: false })
        .limit(1)

      const maxPosition = existingTabs && existingTabs.length > 0 
        ? (existingTabs[0].position || 0) + 1 
        : 0

      // Create interface_view entry
      const { data, error } = await supabase
        .from('interface_views')
        .insert({
          interface_id: pageId,
          view_id: selectedViewId,
          name: newTabName.trim(),
          position: maxPosition,
        })
        .select()
        .single()

      if (error) {
        // If table doesn't exist, silently fail (feature not available)
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          toast({
            variant: "destructive",
            title: "Feature not available",
            description: "Interface views table does not exist. Please run database migrations.",
          })
          return
        }
        throw error
      }

      await loadTabs()
      setShowAddDialog(false)
      setNewTabName("")
      setSelectedViewId("")
      
      // Switch to new tab
      if (data) {
        onViewChange(data.view_id)
      }
    } catch (error: any) {
      console.error('Error adding tab:', error)
      toast({
        variant: "destructive",
        title: "Failed to add view tab",
        description: error.message || "Please try again",
      })
    }
  }

  async function handleDeleteTab(tabId: string, viewId: string) {
    if (!confirm("Are you sure you want to remove this view tab?")) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('interface_views')
        .delete()
        .eq('id', tabId)

      if (error) throw error

      await loadTabs()
      
      // If deleted tab was active, switch to first remaining tab or blocks view
      if (activeViewId === viewId) {
        const remainingTabs = tabs.filter(t => t.id !== tabId)
        if (remainingTabs.length > 0) {
          onViewChange(remainingTabs[0].view_id)
        } else {
          onViewChange(null) // Show blocks view
        }
      }

      toast({
        variant: "success",
        title: "View tab removed",
      })
    } catch (error: any) {
      console.error('Error deleting tab:', error)
      toast({
        variant: "destructive",
        title: "Failed to remove view tab",
        description: error.message || "Please try again",
      })
    }
  }

  if (loading) {
    return null
  }

  // Don't show tabs if none exist and not editing
  if (tabs.length === 0 && !isEditing) {
    return null
  }

  return (
    <>
      <div className="border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {/* Blocks View Tab (default) */}
          <button
            onClick={() => onViewChange(null)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeViewId === null
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Overview
          </button>

          {/* View Tabs */}
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="group relative"
            >
              <button
                onClick={() => onViewChange(tab.view_id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeViewId === tab.view_id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>{tab.name}</span>
              </button>
              {isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteTab(tab.id, tab.view_id)
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove view tab"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Add Tab Button (edit mode only) */}
          {isEditing && (
            <button
              onClick={() => setShowAddDialog(true)}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Add View</span>
            </button>
          )}
        </div>
      </div>

      {/* Add View Tab Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add View Tab</DialogTitle>
            <DialogDescription>
              Link a table view (Grid, Calendar, Form, etc.) to this interface as a tab
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tab-name">Tab Name</Label>
              <Input
                id="tab-name"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                placeholder="e.g., Calendar, Grid View"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="view-select">View</Label>
              <Select value={selectedViewId} onValueChange={setSelectedViewId}>
                <SelectTrigger id="view-select">
                  <SelectValue placeholder="Select a view..." />
                </SelectTrigger>
                <SelectContent>
                  {availableViews.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name} ({view.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a Grid, Calendar, Kanban, or Form view to link to this tab
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTab}>Add Tab</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

