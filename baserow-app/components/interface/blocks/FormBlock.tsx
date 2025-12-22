"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PageBlock } from "@/lib/interface/types"
import type { TableField as FieldType } from "@/types/database"

interface FormBlockProps {
  block: PageBlock
  isEditing?: boolean
  onSubmit?: (data: Record<string, any>) => void
}

export default function FormBlock({ block, isEditing = false, onSubmit }: FormBlockProps) {
  const { config } = block
  const tableId = config?.table_id
  const [fields, setFields] = useState<FieldType[]>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tableId) {
      loadFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadFields() {
    if (!tableId) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("table_fields")
        .select("*")
        .eq("table_id", tableId)
        .order("position", { ascending: true })

      // If table_fields doesn't exist, just use empty array
      if (error) {
        const errorCode = error.code || ''
        const errorMessage = error.message || ''
        if (errorCode === '42P01' || 
            errorCode === 'PGRST116' || 
            errorCode === '404' ||
            errorMessage?.includes('relation') || 
            errorMessage?.includes('does not exist')) {
          console.warn('table_fields table may not exist, using empty fields array')
          setFields([])
          return
        }
        throw error
      }

      setFields((data || []) as FieldType[])
    } catch (error) {
      console.warn('Error loading fields for form block:', error)
      setFields([])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tableId || !onSubmit) return

    setLoading(true)
    try {
      await onSubmit(formData)
      setFormData({})
    } catch (error) {
      console.error("Form submission error:", error)
    } finally {
      setLoading(false)
    }
  }

  function renderField(field: FieldType) {
    const value = formData[field.name] || ""

    switch (field.type) {
      case "text":
      case "long_text":
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium mb-1">{field.name}</label>
            {field.type === "long_text" ? (
              <textarea
                value={value}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={4}
                disabled={isEditing}
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={isEditing}
              />
            )}
          </div>
        )

      case "number":
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium mb-1">{field.name}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setFormData({ ...formData, [field.name]: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={isEditing}
            />
          </div>
        )

      case "checkbox":
        return (
          <div key={field.id} className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                className="w-4 h-4"
                disabled={isEditing}
              />
              <span className="text-sm font-medium">{field.name}</span>
            </label>
          </div>
        )

      case "date":
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium mb-1">{field.name}</label>
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={isEditing}
            />
          </div>
        )

      default:
        return (
          <div key={field.id} className="mb-4">
            <label className="block text-sm font-medium mb-1">{field.name}</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              disabled={isEditing}
            />
          </div>
        )
    }
  }

  if (!tableId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {isEditing ? "Select a table for the form" : "No table selected"}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => renderField(field))}
        {!isEditing && (
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        )}
      </form>
    </div>
  )
}
