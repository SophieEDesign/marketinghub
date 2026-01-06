"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { X } from "lucide-react"
import { format, parseISO, isValid } from "date-fns"
import type { TableRow } from "@/types/database"
import type { TableField } from "@/types/fields"

interface RowDetailViewProps {
  tableId: string
  rowId: string
  fieldIds: string[]
  onClose?: () => void
}

export default function RowDetailView({
  tableId,
  rowId,
  fieldIds,
  onClose,
}: RowDetailViewProps) {
  const [row, setRow] = useState<TableRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [fields, setFields] = useState<TableField[]>([])

  useEffect(() => {
    loadRow()
    loadFields()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, tableId])

  async function loadFields() {
    try {
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position")

      if (!error && data) {
        setFields(data as TableField[])
      }
    } catch (error) {
      console.error("Error loading fields:", error)
    }
  }

  async function loadRow() {
    setLoading(true)
    const { data, error } = await supabase
      .from("table_rows")
      .select("*")
      .eq("id", rowId)
      .single()

    if (data) {
      setRow(data)
      setFormData(data.data || {})
    }
    setLoading(false)
  }

  function formatFieldValue(fieldId: string, value: any): string {
    if (value === null || value === undefined || value === "") {
      return "—"
    }

    // Find the field definition
    const field = fields.find((f) => f.id === fieldId || f.name === fieldId)
    
    // Format date fields
    if (field?.type === "date") {
      try {
        let date: Date
        if (typeof value === "string") {
          // Try parsing as ISO first
          if (value.includes("T") || value.includes("Z")) {
            date = parseISO(value)
          } else {
            // Try parsing as date string
            date = new Date(value)
          }
        } else if (value instanceof Date) {
          date = value
        } else {
          date = new Date(value)
        }
        
        if (isValid(date) && !isNaN(date.getTime())) {
          return format(date, "MMM d, yyyy")
        }
      } catch {
        // If parsing fails, return as string
      }
    }

    return String(value)
  }

  function getFieldType(fieldId: string): string | null {
    const field = fields.find((f) => f.id === fieldId || f.name === fieldId)
    return field?.type || null
  }

  async function handleSave() {
    if (!row) return

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from("table_rows")
      .update({
        data: formData,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      .eq("id", rowId)

    if (!error) {
      setEditing(false)
      loadRow()
    }
  }

  function handleFieldChange(fieldId: string, value: any) {
    setFormData((prev) => ({ ...prev, [fieldId]: value }))
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  if (!row) {
    return <div className="p-4">Row not found</div>
  }

  const content = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Row Details</CardTitle>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fieldIds.map((fieldId) => {
            const fieldType = getFieldType(fieldId)
            const field = fields.find((f) => f.id === fieldId || f.name === fieldId)
            const fieldName = field?.name || fieldId
            
            return (
              <div key={fieldId} className="space-y-2">
                <label className="text-sm font-medium">{fieldName}</label>
                {editing ? (
                  fieldType === "date" ? (
                    <input
                      type="date"
                      value={
                        formData[fieldId]
                          ? (() => {
                              try {
                                const dateValue = typeof formData[fieldId] === "string" 
                                  ? parseISO(formData[fieldId]) 
                                  : new Date(formData[fieldId])
                                if (isValid(dateValue) && !isNaN(dateValue.getTime())) {
                                  return format(dateValue, "yyyy-MM-dd")
                                }
                              } catch {
                                // If parsing fails, return empty
                              }
                              return ""
                            })()
                          : ""
                      }
                      onChange={(e) => {
                        const dateValue = e.target.value
                          ? new Date(e.target.value + "T00:00:00").toISOString()
                          : null
                        handleFieldChange(fieldId, dateValue)
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[fieldId] || ""}
                      onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  )
                ) : (
                  <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                    {formatFieldValue(fieldId, row.data[fieldId])}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )

  if (onClose) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Row Details</DialogTitle>
            <DialogDescription>
              View and edit the details of this record.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return content
}
