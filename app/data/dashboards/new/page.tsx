'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export default function NewDashboardPage() {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('')
  const [tableId, setTableId] = useState<string>('')
  const [tables, setTables] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTables()
  }, [])

  async function loadTables() {
    const supabase = createClientSupabaseClient()
    const { data, error } = await supabase
      .from('tables')
      .select('id, name')
      .order('name', { ascending: true })

    if (data) {
      setTables(data)
      if (data.length > 0) {
        setTableId(data[0].id)
      }
    }
  }

  const handleCreate = async () => {
    if (!name.trim() || !tableId) return

    setLoading(true)
    const supabase = createClientSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    try {
      const { data: view, error } = await supabase
        .from('views')
        .insert([
          {
            table_id: tableId,
            name,
            type: 'page', // Interface Page / Dashboard
            config: {},
            owner_id: user?.id,
            access_level: 'authenticated',
          },
        ])
        .select()
        .single()

      if (error) throw error

      router.push(`/data/${tableId}/views/${view.id}`)
      router.refresh()
    } catch (error) {
      console.error('Error creating dashboard:', error)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Dashboard</DialogTitle>
          <DialogDescription>
            Create a new interface page (dashboard) with blocks
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Dashboard Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dashboard"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Table</label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim() || !tableId}>
            {loading ? 'Creating...' : 'Create Dashboard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
