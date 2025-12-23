"use client"

import { useState, useEffect, memo } from "react"
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface ViewsTabProps {
  tableId: string
  tableName: string
}

interface View {
  id: string
  name: string
  type: string
  visible?: boolean
  position?: number
}

const ViewsTab = memo(function ViewsTab({ tableId, tableName }: ViewsTabProps) {
  const router = useRouter()
  const [views, setViews] = useState<View[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadViews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  async function loadViews() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("views")
        .select("id, name, type, config")
        .eq("table_id", tableId)
        .order("created_at", { ascending: true })

      if (error) throw error

      setViews(data || [])
    } catch (error) {
      console.error("Error loading views:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteView(viewId: string, viewName: string) {
    if (!confirm(`Are you sure you want to delete the view "${viewName}"?`)) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("views")
        .delete()
        .eq("id", viewId)

      if (error) throw error

      await loadViews()
    } catch (error) {
      console.error("Error deleting view:", error)
      alert("Failed to delete view")
    }
  }

  function getViewTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      grid: "Grid",
      kanban: "Kanban",
      calendar: "Calendar",
      form: "Form",
      interface: "Interface",
    }
    return labels[type] || type
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading views...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Views</h3>
        <Button
          size="sm"
          onClick={() => router.push(`/tables/${tableId}/views/new`)}
          className="h-8 px-3 text-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New View
        </Button>
      </div>

      {views.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
          <p className="text-sm">No views yet</p>
          <p className="text-xs mt-1">Create your first view to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {views.map((view) => (
            <div
              key={view.id}
              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-blue-600"
                    onClick={() => router.push(`/data/${tableId}/views/${view.id}`)}
                  >
                    {view.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {getViewTypeLabel(view.type)}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/data/${tableId}/views/${view.id}`)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit className="h-3.5 w-3.5 text-gray-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteView(view.id, view.name)}
                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export default ViewsTab
