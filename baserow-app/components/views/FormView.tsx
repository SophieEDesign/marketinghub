"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save } from "lucide-react"
import type { TableRow } from "@/types/database"

interface FormViewProps {
  tableId: string
  viewId: string
  fieldIds: string[]
  rowId?: string
}

export default function FormView({ tableId, viewId, fieldIds, rowId }: FormViewProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (rowId) {
      loadRow()
    }
  }, [rowId])

  async function loadRow() {
    if (!rowId) return
    setLoading(true)
    const { data, error } = await supabase
      .from("table_rows")
      .select("*")
      .eq("id", rowId)
      .single()

    if (data) {
      setFormData(data.data || {})
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (rowId) {
      const { error } = await supabase
        .from("table_rows")
        .update({
          data: formData,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", rowId)

      if (error) {
        console.error("Error updating row:", error)
      }
    } else {
      const { error } = await supabase.from("table_rows").insert([
        {
          table_id: tableId,
          data: formData,
          created_by: user?.id,
        },
      ])

      if (error) {
        console.error("Error creating row:", error)
      } else {
        setFormData({})
      }
    }
    setSaving(false)
  }

  function handleFieldChange(fieldId: string, value: any) {
    setFormData((prev) => ({ ...prev, [fieldId]: value }))
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rowId ? "Edit Record" : "New Record"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fieldIds.map((fieldId) => (
            <div key={fieldId} className="space-y-2">
              <label className="text-sm font-medium">Field {fieldId}</label>
              <Input
                value={formData[fieldId] || ""}
                onChange={(e) => handleFieldChange(fieldId, e.target.value)}
              />
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
