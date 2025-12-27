"use client"

import { useState } from "react"
import { Edit, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import BulkEditModal from "./BulkEditModal"

interface BulkActionBarProps {
  selectedCount: number
  tableName: string
  tableFields: Array<{
    id: string
    name: string
    type: string
    options?: any
  }>
  userRole?: "admin" | "editor" | "viewer" | null
  onClearSelection: () => void
  onBulkUpdate: (updates: Record<string, any>) => Promise<void>
  onBulkDelete?: () => Promise<void>
}

export default function BulkActionBar({
  selectedCount,
  tableName,
  tableFields,
  userRole = "editor",
  onClearSelection,
  onBulkUpdate,
  onBulkDelete,
}: BulkActionBarProps) {
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  const canEdit = userRole === "admin" || userRole === "editor"
  const canDelete = userRole === "admin"

  if (selectedCount === 0) return null

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
          <div className="text-sm font-medium text-gray-700">
            {selectedCount} {selectedCount === 1 ? "record" : "records"} selected
          </div>
          
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                size="sm"
                variant="default"
                onClick={() => setBulkEditOpen(true)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Bulk Edit
              </Button>
            )}
            
            {canDelete && onBulkDelete && (
              <Button
                size="sm"
                variant="destructive"
                onClick={onBulkDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {bulkEditOpen && (
        <BulkEditModal
          isOpen={bulkEditOpen}
          onClose={() => setBulkEditOpen(false)}
          selectedCount={selectedCount}
          tableName={tableName}
          tableFields={tableFields}
          userRole={userRole}
          onSave={async (updates) => {
            await onBulkUpdate(updates)
            setBulkEditOpen(false)
            onClearSelection()
          }}
        />
      )}
    </>
  )
}

