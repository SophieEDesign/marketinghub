"use client"

import { useState, useEffect, memo } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

interface PermissionsTabProps {
  tableId: string
  tableName: string
}

const PermissionsTab = memo(function PermissionsTab({ tableId, tableName }: PermissionsTabProps) {
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    loadPermissions()
    loadUserRole()
  }, [tableId])

  async function loadUserRole() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      setUserRole(profile?.role || null)
    } catch (error) {
      console.error('Error loading user role:', error)
    }
  }

  async function loadPermissions() {
    try {
      const supabase = createClient()
      // For now, we'll use a simple public/private toggle
      // In the future, this could be expanded to role-based permissions
      const { data: table } = await supabase
        .from("tables")
        .select("id, name")
        .eq("id", tableId)
        .single()

      // Check if table has any public views
      const { data: views } = await supabase
        .from("views")
        .select("access_level")
        .eq("table_id", tableId)
        .limit(1)

      setIsPublic(views?.[0]?.access_level === "public")
    } catch (error) {
      console.error("Error loading permissions:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleTogglePublic(checked: boolean) {
    try {
      const supabase = createClient()
      
      // Update all views for this table
      const { error } = await supabase
        .from("views")
        .update({ access_level: checked ? "public" : "authenticated" })
        .eq("table_id", tableId)

      if (error) throw error

      setIsPublic(checked)
    } catch (error) {
      console.error("Error updating permissions:", error)
      alert("Failed to update permissions")
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading permissions...</div>
  }

  if (userRole !== "admin") {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">Only admins can manage permissions</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Table Permissions</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="public-access">Public Access</Label>
              <p className="text-xs text-muted-foreground">
                Allow unauthenticated users to view this table
              </p>
            </div>
            <Switch
              id="public-access"
              checked={isPublic}
              onCheckedChange={handleTogglePublic}
            />
          </div>

          <div className="p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <Label>Admin</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Full access to view and edit
                </p>
              </div>
              <Badge variant="default">Always enabled</Badge>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label>Member</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Can view and edit this table
                </p>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default PermissionsTab
