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

      // Load field groups
      const { data: groupsData } = await supabase
        .from("field_groups")
        .select("name, fields")
        .eq("table_id", tableId)

      if (groupsData) {
        const groups: Record<string, string[]> = {}
        groupsData.forEach((group) => {
          if (group.fields && Array.isArray(group.fields)) {
            group.fields.forEach((fieldName: string) => {
              if (!groups[fieldName]) {
                groups[fieldName] = []
              }
              groups[fieldName].push(group.name)
            })
          }
        })
        setFieldGroups(groups)
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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/tables/${tableId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {tableName}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Record {recordId.substring(0, 8)}...
              </p>
            </div>
          </div>
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Record Fields */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900">Fields</h2>
                </div>
                <div className="p-6">
                  <RecordFields
                    fields={fields}
                    formData={formData}
                    onFieldChange={handleFieldChange}
                    fieldGroups={fieldGroups}
                    tableId={tableId}
                    recordId={recordId}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar */}
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
          </div>
        </div>
      </div>

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

