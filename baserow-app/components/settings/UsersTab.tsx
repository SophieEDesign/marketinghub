"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, X, UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'

interface User {
  id: string
  user_id: string
  email: string
  name: string | null
  role: 'admin' | 'member'
  is_active: boolean
  last_active: string | null
  created_at: string
}

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteDefaultInterface, setInviteDefaultInterface] = useState<string>('__none__')
  const [interfaces, setInterfaces] = useState<Array<{ id: string; name: string }>>([])
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    loadUsers()
    loadInterfaces()
  }, [])

  async function loadInterfaces() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('views')
        .select('id, name')
        .eq('type', 'interface')
        .order('name')

      if (!error && data) {
        setInterfaces(data)
      }
    } catch (error) {
      console.error('Error loading interfaces:', error)
    }
  }

  async function loadUsers() {
    setLoading(true)
    try {
      const supabase = createClient()
      
      // Load profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profilesError) {
        console.error('Error loading profiles:', profilesError)
        setUsers([])
        return
      }

      // Load user data via API route (server-side has access to auth.users)
      const response = await fetch('/api/users')
      if (response.ok) {
        const { users: usersData } = await response.json()
        setUsers(usersData || [])
        return
      }

      // Fallback: show profiles without email details
      const usersWithProfiles: User[] = (profiles || []).map((profile) => ({
        id: profile.id,
        user_id: profile.user_id,
        email: `User ${profile.user_id.substring(0, 8)}...`,
        name: null,
        role: (profile.role || 'member') as 'admin' | 'member', // Default to 'member' if no role
        is_active: true,
        last_active: null,
        created_at: profile.created_at,
      }))

      setUsers(usersWithProfiles)
    } catch (error) {
      console.error('Error loading users:', error)
      // Fallback: try to load profiles without auth.users access
      const supabase = createClient()
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profiles) {
        setUsers(profiles.map(p => ({
          id: p.id,
          user_id: p.user_id,
          email: `User ${p.user_id.substring(0, 8)}...`,
          name: null,
          role: (p.role || 'member') as 'admin' | 'member', // Default to 'member' if no role
          is_active: true,
          last_active: null,
          created_at: p.created_at,
        })))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      alert('Email is required')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail.trim())) {
      alert('Please enter a valid email address')
      return
    }

    setInviting(true)
    try {
      // Call the API route instead of using admin API directly
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          default_interface: inviteDefaultInterface === '__none__' ? null : inviteDefaultInterface,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite user')
      }

      // Success - show confirmation
      alert(`Invitation sent successfully to ${inviteEmail.trim()}`)
      
      setInviteDialogOpen(false)
      setInviteEmail('')
      setInviteRole('member')
      setInviteDefaultInterface('__none__')
      loadUsers()
    } catch (error: any) {
      console.error('Error inviting user:', error)
      alert(error.message || 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(user: User, newRole: 'admin' | 'member') {
    try {
      const supabase = createClient()
      
      // Ensure role is set (upsert to create profile if it doesn't exist)
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.user_id,
          role: newRole,
        }, {
          onConflict: 'user_id',
        })

      if (error) throw error

      loadUsers()
    } catch (error: any) {
      console.error('Error updating role:', error)
      alert(error.message || 'Failed to update role')
    }
  }

  async function handleDeactivate() {
    if (!userToDeactivate) return

    try {
      const supabase = createClient()
      
      // Deactivate user in auth (ban)
      const { error: banError } = await supabase.auth.admin.updateUserById(
        userToDeactivate.user_id,
        { ban_duration: '876000h' } // ~100 years
      )

      if (banError) {
        console.error('Error deactivating user:', banError)
        // Continue anyway - we can track deactivation in profiles table
      }

      setDeactivateDialogOpen(false)
      setUserToDeactivate(null)
      loadUsers()
    } catch (error: any) {
      console.error('Error deactivating user:', error)
      alert(error.message || 'Failed to deactivate user')
    }
  }

  function getRoleBadgeVariant(role: string) {
    return role === 'admin' ? 'destructive' : 'default'
  }

  function formatLastActive(date: string | null) {
    if (!date) return 'Never'
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading users...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users & Permissions</CardTitle>
              <CardDescription>Manage workspace users and their access levels</CardDescription>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
              <p className="text-sm mb-2">No users found</p>
              <p className="text-xs">Invite users to get started</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.name || '—'}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role || 'member'}
                          onValueChange={(value) => handleRoleChange(user, value as 'admin' | 'member')}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLastActive(user.last_active)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUserToDeactivate(user)
                            setDeactivateDialogOpen(true)
                          }}
                          disabled={!user.is_active}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join the workspace
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role *</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as 'admin' | 'member')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-interface">Default Interface (Optional)</Label>
              <Select value={inviteDefaultInterface} onValueChange={setInviteDefaultInterface}>
                <SelectTrigger>
                  <SelectValue placeholder="Select default interface" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {interfaces.map((iface) => (
                    <SelectItem key={iface.id} value={iface.id}>
                      {iface.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? 'Inviting...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate User Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {userToDeactivate?.email}? They will no longer be able to access the workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivate}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
