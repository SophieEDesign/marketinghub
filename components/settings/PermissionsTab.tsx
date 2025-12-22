"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClientSupabaseClient } from '@/lib/supabase'

interface UserRole {
  id: string
  user_id: string
  role: 'admin' | 'editor' | 'viewer'
  email?: string
  created_at?: string
}

export default function SettingsPermissionsTab() {
  const [users, setUsers] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const supabase = createClientSupabaseClient()
      
      // Load user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false })

      if (rolesError) {
        console.error('Error loading user roles:', rolesError)
        // If table doesn't exist, that's okay - show empty state
        setUsers([])
        return
      }

      // Try to get user emails (this requires admin access or a different approach)
      // For now, we'll just show the user IDs
      const usersWithRoles: UserRole[] = (userRoles || []).map((role) => ({
        id: role.id,
        user_id: role.user_id,
        role: role.role,
        created_at: role.created_at,
      }))

      setUsers(usersWithRoles)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  function getRoleBadgeVariant(role: string) {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'editor':
        return 'default'
      case 'viewer':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading permissions...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
        <CardDescription>Manage access control and user permissions</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="space-y-4">
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
              <p className="text-sm mb-2">No users found</p>
              <p className="text-xs">User roles will appear here once assigned.</p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Advanced permissions management is coming soon. 
                For now, all authenticated users have access based on their role.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
              <div className="col-span-6">User</div>
              <div className="col-span-3">Role</div>
              <div className="col-span-3">Added</div>
            </div>
            {users.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-50 rounded-md transition-colors border-b"
              >
                <div className="col-span-6">
                  <div className="font-medium">
                    {user.email || `User ${user.user_id.substring(0, 8)}...`}
                  </div>
                  {!user.email && (
                    <div className="text-xs text-muted-foreground">
                      {user.user_id}
                    </div>
                  )}
                </div>
                <div className="col-span-3">
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role}
                  </Badge>
                </div>
                <div className="col-span-3 text-sm text-gray-500">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : '—'}
                </div>
              </div>
            ))}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-4">
              <p className="text-sm text-blue-800">
                <strong>Coming soon:</strong> Add users, change roles, and configure granular permissions.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
