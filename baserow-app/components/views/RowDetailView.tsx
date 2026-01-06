"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { X } from "lucide-react"
import type { TableRow } from "@/types/database"

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

  useEffect(() => {
    loadRow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId])

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
          {fieldIds.map((fieldId) => (
            <div key={fieldId} className="space-y-2">
              <label className="text-sm font-medium">Field {fieldId}</label>
              {editing ? (
                <input
                  type="text"
                  value={formData[fieldId] || ""}
                  onChange={(e) => handleFieldChange(fieldId, e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              ) : (
                <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                  {String(row.data[fieldId] || "—")}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  if (onClose) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="row-detail-view-description">
          <DialogHeader>
            <DialogTitle>Row Details</DialogTitle>
            <DialogDescription id="row-detail-view-description">
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
