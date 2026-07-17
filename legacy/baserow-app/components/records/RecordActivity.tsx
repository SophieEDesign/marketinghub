"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatUserDisplayName } from "@/lib/users/userDisplay"

interface RecordActivityProps {
  record: Record<string, any>
  tableId: string
}

export default function RecordActivity({ record, tableId }: RecordActivityProps) {
  const [createdBy, setCreatedBy] = useState<string | null>(null)
  const [modifiedBy, setModifiedBy] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    loadActivityMetadata()
  }, [record, tableId])

  function formatFriendlyDate(dateValue: string | null | undefined) {
    if (!dateValue) return null
    try {
      const d = new Date(dateValue)
      if (Number.isNaN(d.getTime())) return null
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d)
    } catch {
      return null
    }
  }


  async function loadActivityMetadata() {
    if (record.created_by || record.updated_by) {
      try {
        const supabase = createClient()
        const userIds = [record.created_by, record.updated_by].filter(Boolean)
        if (userIds.length > 0) {
          // Use a safe view that exposes auth.users email (sync_users_and_profiles.sql)
          const { data: users } = await supabase
            .from("user_profile_sync_status")
            .select("user_id, email")
            .in("user_id", userIds)

          if (users) {
            const userMap = new Map(users.map((u: any) => [u.user_id, u.email || null]))
            if (record.created_by) {
              setCreatedBy(userMap.get(record.created_by) || null)
            }
            if (record.updated_by) {
              setModifiedBy(userMap.get(record.updated_by) || null)
            }
          }
        }
      } catch (error) {
        // View may not exist yet - fail gracefully
        console.warn("Could not load audit user metadata:", error)
      }
    }
  }

  const createdAt = formatFriendlyDate(record.created_at)
  const updatedAt = formatFriendlyDate(record.updated_at)
  const isModified = !!(updatedAt && createdAt && record.updated_at !== record.created_at)

  return (
    <div className="border-t border-gray-200 pt-6">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={!collapsed}
      >
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Activity
        </h3>
        <span className="text-gray-400">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-4 space-y-3 text-sm">
          {createdAt && (
            <div className="text-gray-900">
              Created by {formatUserDisplayName(createdBy)} on {createdAt}
            </div>
          )}
          {isModified && updatedAt && (
            <div className="text-gray-900">
              Last modified by {formatUserDisplayName(modifiedBy)} on {updatedAt}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

