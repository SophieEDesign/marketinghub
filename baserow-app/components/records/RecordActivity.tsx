"use client"

import { useState, useEffect } from "react"
import { Clock, User, Edit } from "lucide-react"
import { formatDateTimeUK } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface RecordActivityProps {
  record: Record<string, any>
  tableId: string
}

export default function RecordActivity({ record, tableId }: RecordActivityProps) {
  const [createdBy, setCreatedBy] = useState<string | null>(null)
  const [modifiedBy, setModifiedBy] = useState<string | null>(null)

  useEffect(() => {
    loadActivityMetadata()
  }, [record, tableId])

  async function loadActivityMetadata() {
    // For now, we'll use created_at and updated_at
    // In future, this can be expanded to show:
    // - Comments
    // - Field change history
    // - Mentions
    // - Collaborators

    // Try to get user info if owner_id exists
    if (record.created_by || record.updated_by) {
      try {
        const supabase = createClient()
        const userIds = [record.created_by, record.updated_by].filter(Boolean)
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from("profiles")
            .select("id, email, full_name")
            .in("id", userIds)

          if (users) {
            const userMap = new Map(users.map((u) => [u.id, u.email || u.full_name || "Unknown"]))
            if (record.created_by) {
              setCreatedBy(userMap.get(record.created_by) || null)
            }
            if (record.updated_by) {
              setModifiedBy(userMap.get(record.updated_by) || null)
            }
          }
        }
      } catch (error) {
        // Profiles table may not exist - this is fine
        console.warn("Could not load user metadata:", error)
      }
    }
  }

  // UK format: DD/MM/YYYY HH:mm
  const createdAt = record.created_at
    ? formatDateTimeUK(record.created_at)
    : null

  const updatedAt = record.updated_at
    ? formatDateTimeUK(record.updated_at)
    : null

  const isModified = updatedAt && createdAt && record.updated_at !== record.created_at

  return (
    <div className="border-t border-gray-200 pt-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Activity
      </h3>
      <div className="space-y-3">
        {/* Created */}
        {createdAt && (
          <div className="flex items-start gap-3 text-sm">
            <div className="mt-0.5">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
            <div className="flex-1">
              <div className="text-gray-900">
                Record created
                {createdBy && (
                  <span className="text-gray-600"> by {createdBy}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{createdAt}</div>
            </div>
          </div>
        )}

        {/* Modified */}
        {isModified && updatedAt && (
          <div className="flex items-start gap-3 text-sm">
            <div className="mt-0.5">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
            </div>
            <div className="flex-1">
              <div className="text-gray-900">
                Record updated
                {modifiedBy && (
                  <span className="text-gray-600"> by {modifiedBy}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{updatedAt}</div>
            </div>
          </div>
        )}

        {/* Placeholder for future features */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">
            Comments and field change history coming soon
          </p>
        </div>
      </div>
    </div>
  )
}

