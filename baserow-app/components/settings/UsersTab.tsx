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
import { Plus, Edit, X, UserX, Trash2, Mail, Key } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { formatDateUK } from '@/lib/utils'
import { validatePassword } from '@/lib/auth-utils'

interface User {
  id: string
  user_id: string
  email: string
  name: string | null
  role: 'admin' | 'member'
  is_active: boolean
  last_active: string | null
  created_at: string
  is_pending?: boolean // True for users who have been invited but haven't accepted yet
  needs_password_reset?: boolean // True for users without passwords (e.g., added via SQL)
}

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reinviting, setReinviting] = useState<string | null>(null)
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false)
  const [userToChangePassword, setUserToChangePassword] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)

  // Edit form state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

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
        const data = await response.json()
        // Ensure users is always an array (defensive check)
        const usersData = Array.isArray(data?.users) ? data.users : []
        setUsers(usersData)
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
        }),
      })

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        // If JSON parsing fails, use the response status text
        throw new Error(`Server error: ${response.status} ${response.statusText || 'Unknown error'}`)
      }

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || `Server error: ${response.status} ${response.statusText || 'Unknown error'}`
        const errorDetails = data?.details ? `\n\n${data.details}` : ''
        throw new Error(errorMessage + errorDetails)
      }

      // Success - show confirmation
      alert(`Invitation sent successfully to ${inviteEmail.trim()}`)
      
      setInviteDialogOpen(false)
      setInviteEmail('')
      setInviteRole('member')
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

  async function handleEdit(user: User) {
    setEditingUser(user)
    setEditEmail(user.email)
    setEditName(user.name || '')
    setEditDialogOpen(true)
  }

  async function handleUpdateUser() {
    if (!editingUser) return

    // Check if anything has changed
    const emailChanged = editEmail.trim() !== editingUser.email
    const nameChanged = editName.trim() !== (editingUser.name || '')

    if (!emailChanged && !nameChanged) {
      alert('No changes to save')
      return
    }

    // Validate email format if changed
    if (emailChanged) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(editEmail.trim())) {
        alert('Please enter a valid email address')
        return
      }
    }

    setUpdating(true)
    try {
      // Build update payload with only changed fields
      const updatePayload: { email?: string; name?: string } = {}
      if (emailChanged) {
        updatePayload.email = editEmail.trim()
      }
      if (nameChanged) {
        updatePayload.name = editName.trim()
      }

      // Double-check: ensure at least one field is provided
      if (Object.keys(updatePayload).length === 0) {
        alert('No changes to save')
        setUpdating(false)
        return
      }

      const response = await fetch(`/api/users/${editingUser.user_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      })

      const data = await response.json()

      if (!response.ok) {
        // Show detailed error message if available
        const errorMessage = data.error || 'Failed to update user'
        const errorDetails = data.details ? `\n\n${data.details}` : ''
        throw new Error(errorMessage + errorDetails)
      }

      // Success - close dialog and reload users
      setEditDialogOpen(false)
      setEditingUser(null)
      setEditEmail('')
      setEditName('')
      loadUsers()
    } catch (error: any) {
      console.error('Error updating user:', error)
      // Show detailed error message including configuration instructions
      const errorMessage = error.message || 'Failed to update user'
      alert(errorMessage)
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeactivate() {
    if (!userToDeactivate) return

    try {
      const response = await fetch(`/api/users/${userToDeactivate.user_id}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate user')
      }

      setDeactivateDialogOpen(false)
      setUserToDeactivate(null)
      loadUsers()
    } catch (error: any) {
      console.error('Error deactivating user:', error)
      alert(error.message || 'Failed to deactivate user')
    }
  }

  async function handleDelete() {
    if (!userToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/users/${userToDelete.user_id}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      setDeleteDialogOpen(false)
      setUserToDelete(null)
      loadUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      alert(error.message || 'Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  async function handleReinvite(user: User) {
    setReinviting(user.user_id)
    try {
      const response = await fetch(`/api/users/${user.user_id}/reinvite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reinvite user')
      }

      alert(`Invitation sent successfully to ${user.email}`)
      loadUsers()
    } catch (error: any) {
      console.error('Error reinviting user:', error)
      alert(error.message || 'Failed to reinvite user')
    } finally {
      setReinviting(null)
    }
  }

  function handleChangePasswordClick(user: User) {
    setUserToChangePassword(user)
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setConfirmPasswordError(null)
    setChangePasswordDialogOpen(true)
  }

  async function handleChangePassword() {
    if (!userToChangePassword) return

    // Reset errors
    setPasswordError(null)
    setConfirmPasswordError(null)

    // Validate password
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.error || 'Invalid password')
      return
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const response = await fetch(`/api/users/${userToChangePassword.user_id}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      // Success
      alert(`Password changed successfully for ${userToChangePassword.email}`)
      setChangePasswordDialogOpen(false)
      setUserToChangePassword(null)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Error changing password:', error)
      setPasswordError(error.message || 'Failed to change password')
    } finally {
      setChangingPassword(false)
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
    return formatDateUK(d.toISOString())
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
              <CardTitle>Users</CardTitle>
              <CardDescription>Who can access the workspace</CardDescription>
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
                  {Array.isArray(users) && users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name || '—'}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.is_pending ? (
                            <Badge variant="outline">
                              {user.role === 'admin' ? 'Admin' : 'Member'}
                            </Badge>
                          ) : (
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
                          )}
                        </TableCell>
                        <TableCell>
                          {user.is_pending ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                              Pending
                            </Badge>
                          ) : (
                            <Badge variant={user.is_active ? 'default' : 'secondary'}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLastActive(user.last_active)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              title="Edit user"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!user.is_pending && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleChangePasswordClick(user)}
                                title="Change password"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                            )}
                            {(user.is_pending || user.needs_password_reset) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReinvite(user)}
                                disabled={reinviting === user.user_id}
                                title={user.is_pending ? "Resend invitation" : "Send password reset email"}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserToDeactivate(user)
                                setDeactivateDialogOpen(true)
                              }}
                              disabled={!user.is_active}
                              title="Deactivate user"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserToDelete(user)
                                setDeleteDialogOpen(true)
                              }}
                              title="Delete user"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
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

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user email and name
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false)
              setEditingUser(null)
              setEditEmail('')
              setEditName('')
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updating || !editEmail.trim()}>
              {updating ? 'Updating...' : 'Update User'}
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
            <Button variant="outline" onClick={() => {
              setDeactivateDialogOpen(false)
              setUserToDeactivate(null)
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivate}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {userToDelete?.email}? This action cannot be undone. The user will be removed from the system completely.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false)
              setUserToDelete(null)
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for {userToChangePassword?.email}. The user will need to use this password to sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password *</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (passwordError) setPasswordError(null)
                }}
                onBlur={() => {
                  if (newPassword) {
                    const validation = validatePassword(newPassword)
                    if (!validation.valid) {
                      setPasswordError(validation.error || 'Invalid password')
                    }
                  }
                }}
                placeholder="Enter new password"
                required
                minLength={8}
                className={passwordError ? 'border-destructive' : ''}
              />
              {passwordError ? (
                <p className="text-sm text-destructive">{passwordError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, numbers, or special characters
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password *</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (confirmPasswordError) setConfirmPasswordError(null)
                }}
                onBlur={() => {
                  if (confirmPassword && newPassword && confirmPassword !== newPassword) {
                    setConfirmPasswordError('Passwords do not match')
                  }
                }}
                placeholder="Confirm new password"
                required
                minLength={8}
                className={confirmPasswordError ? 'border-destructive' : ''}
              />
              {confirmPasswordError && (
                <p className="text-sm text-destructive">{confirmPasswordError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChangePasswordDialogOpen(false)
              setUserToChangePassword(null)
              setNewPassword('')
              setConfirmPassword('')
              setPasswordError(null)
              setConfirmPasswordError(null)
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword || !newPassword || !confirmPassword || !!passwordError || !!confirmPasswordError}
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
