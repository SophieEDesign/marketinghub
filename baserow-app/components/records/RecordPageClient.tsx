"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trash2, MoreVertical } from "lucide-react"
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
  const [fieldsLoaded, setFieldsLoaded] = useState(false)
  const [fieldsLoadError, setFieldsLoadError] = useState<string | null>(null)
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
    setFieldsLoaded(false)
    setFieldsLoadError(null)
    try {
      const supabase = createClient()

      const [{ data: recordData, error: recordError }, { data: fieldsData, error: fieldsError }] =
        await Promise.all([
          supabase
            .from(supabaseTableName)
            .select("*")
            .eq("id", recordId)
            .single(),
          supabase
            .from("table_fields")
            .select("*")
            .eq("table_id", tableId)
            .order("position"),
        ])

      if (recordError) throw recordError
      setRecord(recordData)

      if (fieldsError) {
        setFields([])
        setFieldGroups({})
        setFieldsLoadError(fieldsError.message || "Failed to load fields")
      } else {
        const tableFields = (fieldsData || []) as TableField[]
        setFields(tableFields)

        const groups: Record<string, string[]> = {}
        tableFields.forEach((field: any) => {
          if (field.group_name) {
            if (!groups[field.group_name]) groups[field.group_name] = []
            groups[field.group_name].push(field.name)
          }
        })
        setFieldGroups(groups)
      }

      setFieldsLoaded(true)
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

  const fieldsByName = useMemo(() => {
    const m = new Map<string, TableField>()
    for (const f of fields) m.set(f.name, f)
    return m
  }, [fields])

  const isFieldEditable = useCallback((fieldName: string) => {
    const f = fieldsByName.get(fieldName)
    if (!f) return false
    if (f.options?.read_only) return false
    if (f.type === "lookup" || f.type === "formula") return false
    return true
  }, [fieldsByName])

  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    // Optimistic UI update
    setRecord((prev) => ({ ...(prev || {}), [fieldName]: value }))

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from(supabaseTableName)
        .update({ [fieldName]: value })
        .eq("id", recordId)

      if (error) throw error
    } catch (error: any) {
      console.error("Error saving field:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save field",
      })
      // Re-sync from server after failure (avoids stale UI)
      loadData()
    }
  }, [recordId, supabaseTableName, toast])

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
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

  if (!fieldsLoaded) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    )
  }

  if (fieldsLoadError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="text-lg font-semibold mb-2">Unable to load record</p>
          <p className="text-sm text-gray-500 mb-4">{fieldsLoadError}</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/tables/${tableId}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Table
            </Button>
            <Button onClick={loadData}>Retry</Button>
          </div>
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
                {titleField && record?.[titleField.name]
                  ? String(record?.[titleField.name]).substring(0, 30) +
                    (String(record?.[titleField.name]).length > 30 ? "..." : "")
                  : "Untitled"}
              </h1>
            </div>
          </div>
          {/* Desktop actions in header */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    {record?.[titleField.name] ? String(record?.[titleField.name]) : '—'}
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
                    formData={record || {}}
                    onFieldChange={handleFieldChange}
                    fieldGroups={fieldGroups}
                    tableId={tableId}
                    recordId={recordId}
                    isFieldEditable={isFieldEditable}
                    tableName={supabaseTableName}
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
      
      {/* Mobile action bar removed: no global edit mode; fields autosave inline. */}

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
              Close
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

