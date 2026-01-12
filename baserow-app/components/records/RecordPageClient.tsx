"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Edit2, X, Copy, Trash2, MoreVertical } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import RecordHeader from "./RecordHeader"
import RecordFields from "./RecordFields"
import RecordActivity from "./RecordActivity"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useIsMobile } from "@/hooks/useResponsive"
import { cn } from "@/lib/utils"
import type { TableField } from "@/types/database"

interface RecordPageClientProps {
  tableId: string
  recordId: string
  tableName: string
  supabaseTableName: string
}

export default function RecordPageClient({
  tableId,
  recordId,
  tableName,
  supabaseTableName,
}: RecordPageClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [record, setRecord] = useState<Record<string, any> | null>(null)
  const [fields, setFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [fieldGroups, setFieldGroups] = useState<Record<string, string[]>>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Find title field (first text field or first field)
  const titleField = fields.find(f => f.type === 'text') || fields[0]

  useEffect(() => {
    loadData()
  }, [tableId, recordId])

  async function loadData() {
    setLoading(true)
    try {
      const supabase = createClient()

      // Load record
      const { data: recordData, error: recordError } = await supabase
        .from(supabaseTableName)
        .select("*")
        .eq("id", recordId)
        .single()

      if (recordError) throw recordError
      setRecord(recordData)
      setFormData(recordData || {})

      // Load fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position")

      if (!fieldsError && fieldsData) {
        setFields(fieldsData as TableField[])
      }

      // Load field groups from table_fields (using group_name column)
      // Field groups are stored as group_name on table_fields, not in a separate table
      try {
        const { data: fieldsWithGroups, error: groupsError } = await supabase
          .from("table_fields")
          .select("name, group_name")
          .eq("table_id", tableId)
          .not("group_name", "is", null)

        if (!groupsError && fieldsWithGroups) {
          const groups: Record<string, string[]> = {}
          fieldsWithGroups.forEach((field: any) => {
            if (field.group_name) {
              if (!groups[field.group_name]) {
                groups[field.group_name] = []
              }
              groups[field.group_name].push(field.name)
            }
          })
          setFieldGroups(groups)
        }
      } catch (error) {
        // Field groups may not be available - this is fine, continue without them
        console.warn("Field groups not available:", error)
        setFieldGroups({})
      }
    } catch (error: any) {
      console.error("Error loading record:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load record",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!record || !hasChanges) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(supabaseTableName)
        .update(formData)
        .eq("id", recordId)

      if (error) throw error

      toast({
        title: "Saved",
        description: "Record updated successfully",
      })

      setEditing(false)
      setHasChanges(false)
      loadData()
    } catch (error: any) {
      console.error("Error saving record:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save record",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(supabaseTableName)
        .delete()
        .eq("id", recordId)

      if (error) throw error

      toast({
        title: "Deleted",
        description: "Record deleted successfully",
      })

      router.push(`/tables/${tableId}`)
    } catch (error: any) {
      console.error("Error deleting record:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete record",
      })
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  function handleFieldChange(fieldName: string, value: any) {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
    setHasChanges(true)
  }

  function handleCopyId() {
    navigator.clipboard.writeText(recordId)
    toast({
      title: "Copied",
      description: "Record ID copied to clipboard",
    })
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading record...</p>
        </div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Record not found</p>
          <Button variant="outline" onClick={() => router.push(`/tables/${tableId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Table
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 mobile:px-3 py-4 mobile:py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 mobile:gap-1.5 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/tables/${tableId}`)}
              className="mobile:px-2"
            >
              <ArrowLeft className="h-4 w-4 mobile:mr-0 mr-2" />
              <span className="mobile:hidden">Back</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg mobile:text-base font-semibold text-gray-900 truncate">
                {isMobile && titleField && formData[titleField.name]
                  ? String(formData[titleField.name]).substring(0, 30) + (String(formData[titleField.name]).length > 30 ? '...' : '')
                  : tableName}
              </h1>
              {!isMobile && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Record {recordId.substring(0, 8)}...
                </p>
              )}
            </div>
          </div>
          {/* Desktop actions in header */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(false)
                      setFormData({ ...record })
                      setHasChanges(false)
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCopyId}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Record ID
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 mobile:px-4 py-6 mobile:py-4">
          <div className={cn(
            "grid gap-6 mobile:gap-4",
            isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"
          )}>
            {/* Main Content */}
            <div className={cn(
              "space-y-6 mobile:space-y-4",
              !isMobile && "lg:col-span-2"
            )}>
              {/* Title field pinned at top on mobile */}
              {isMobile && titleField && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sticky top-0 z-10">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    {titleField.name}
                  </div>
                  <div className="text-base font-medium text-gray-900">
                    {formData[titleField.name] ? String(formData[titleField.name]) : '—'}
                  </div>
                </div>
              )}
              
              {/* Record Fields */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-6 mobile:px-4 py-4 mobile:py-3 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900">Fields</h2>
                </div>
                <div className="p-6 mobile:p-4">
                  <RecordFields
                    fields={isMobile ? fields.filter(f => f.id !== titleField?.id) : fields}
                    formData={formData}
                    onFieldChange={handleFieldChange}
                    fieldGroups={fieldGroups}
                    tableId={tableId}
                    recordId={recordId}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar - hidden on mobile, shown on tablet/desktop */}
            {!isMobile && (
              <div className="space-y-6">
                {/* Activity */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
                  </div>
                  <div className="p-6">
                    {record && (
                      <RecordActivity
                        tableId={tableId}
                        record={record}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile action bar - sticky at bottom */}
      {isMobile && (
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-2 z-20 shadow-lg">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setEditing(false)
                  setFormData({ ...record })
                  setHasChanges(false)
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSave}
                disabled={!hasChanges || saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEditing(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyId}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Record ID
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

