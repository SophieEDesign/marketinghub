"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save } from "lucide-react"
import type { TableField } from "@/types/fields"
import FieldEditor from "@/components/fields/FieldEditor"
import { useToast } from "@/components/ui/use-toast"

interface FormViewProps {
  tableId: string
  viewId: string
  fieldIds: string[]
  rowId?: string
}

const DEBOUNCE_MS = 400

export default function FormView({ tableId, viewId, fieldIds, rowId }: FormViewProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supabaseTableName, setSupabaseTableName] = useState<string>("")
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const formDataRef = useRef<Record<string, any>>({})

  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach((t) => clearTimeout(t))
      debounceTimersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    loadTableData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  useEffect(() => {
    if (rowId && supabaseTableName) {
      loadRow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, supabaseTableName])

  async function loadTableData() {
    if (!tableId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Load table to get supabase_table name
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('supabase_table')
        .eq('id', tableId)
        .single()

      if (tableError || !table) {
        console.error("Error loading table:", tableError)
        setLoading(false)
        return
      }

      setSupabaseTableName(table.supabase_table)

      // Load table fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('table_fields')
        .select('*')
        .eq('table_id', tableId)
        .order('position', { ascending: true })

      if (fieldsError) {
        console.error("Error loading table fields:", fieldsError)
        setTableFields([])
      } else {
        setTableFields((fieldsData || []) as TableField[])
      }
    } catch (error) {
      console.error("Error loading table data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRow() {
    if (!rowId || !supabaseTableName) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from(supabaseTableName)
        .select("*")
        .eq("id", rowId)
        .single()

      if (error) {
        console.error("Error loading row:", error)
      } else if (data) {
        setFormData(data)
      }
    } catch (error) {
      console.error("Error loading row:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!supabaseTableName) return

    setSaving(true)
    try {
      if (rowId) {
        const { error } = await supabase
          .from(supabaseTableName)
          .update(formData)
          .eq("id", rowId)

        if (error) {
          console.error("Error updating row:", error)
          toast({
            variant: "destructive",
            title: "Failed to update record",
            description: error.message || "Please try again.",
          })
        } else {
          toast({ title: "Record updated", description: "Changes saved successfully." })
        }
      } else {
        const { error } = await supabase
          .from(supabaseTableName)
          .insert([formData])

        if (error) {
          console.error("Error creating row:", error)
          toast({
            variant: "destructive",
            title: "Failed to create record",
            description: error.message || "Please try again.",
          })
        } else {
          toast({ title: "Record created", description: "New record saved successfully." })
          setFormData({})
        }
      }
    } catch (error) {
      console.error("Error saving:", error)
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = useCallback(
    (fieldName: string, value: any) => {
      const oldValue = formDataRef.current[fieldName]
      setFormData((prev) => ({ ...prev, [fieldName]: value }))

      if (!rowId || !supabaseTableName) return

      const existing = debounceTimersRef.current.get(fieldName)
      if (existing) {
        clearTimeout(existing)
        debounceTimersRef.current.delete(fieldName)
      }

      const timer = setTimeout(async () => {
        debounceTimersRef.current.delete(fieldName)
        try {
          const { error } = await supabase
            .from(supabaseTableName)
            .update({ [fieldName]: value })
            .eq("id", rowId)

          if (error) {
            toast({
              variant: "destructive",
              title: "Failed to update field",
              description: error.message || "Please try again.",
            })
            setFormData((prev) => ({ ...prev, [fieldName]: oldValue }))
          }
        } catch (err) {
          toast({
            variant: "destructive",
            title: "Failed to update field",
            description: err instanceof Error ? err.message : "Please try again.",
          })
          setFormData((prev) => ({ ...prev, [fieldName]: oldValue }))
        }
      }, DEBOUNCE_MS)

      debounceTimersRef.current.set(fieldName, timer)
    },
    [rowId, supabaseTableName, toast]
  )

  // Get visible fields - use fieldIds if provided, otherwise show all fields
  const visibleFields = fieldIds.length > 0
    ? tableFields.filter(f => fieldIds.includes(f.id) || fieldIds.includes(f.name))
    : tableFields

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 p-6">
        <div className="text-gray-500">Loading form...</div>
      </div>
    )
  }

  if (!supabaseTableName || tableFields.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md">
          <div className="text-sm mb-2 text-gray-600">Form requires a table connection.</div>
          <div className="text-xs text-gray-400">Please configure the form in Settings.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-2xl shadow-lg border-gray-200">
        <CardHeader className="border-b border-gray-200 bg-white rounded-t-lg">
          <CardTitle className="text-xl font-semibold text-gray-900">
            {rowId ? "Edit Record" : "New Record"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6 bg-white">
          {visibleFields.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No fields configured. Please add fields in Settings.
            </div>
          ) : (
            visibleFields.map((field) => {
              const value = formData[field.name] ?? ""

              return (
                <FieldEditor
                  key={field.id}
                  field={field}
                  value={value}
                  onChange={(newValue) => handleFieldChange(field.name, newValue)}
                  required={field.required || false}
                  recordId={rowId || undefined}
                  tableName={supabaseTableName || undefined}
                />
              )
            })
          )}
          {!rowId && (
            <div className="flex justify-end pt-4 border-t border-gray-200">
              <Button
                onClick={handleSave}
                disabled={saving || visibleFields.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Create"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
