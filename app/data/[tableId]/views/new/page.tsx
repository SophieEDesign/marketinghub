'use client'

import { useState } from 'react'
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
import type { ViewType } from '@/types/database'

export default function NewViewPage({
  params,
}: {
  params: { tableId: string }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('')
  const [type, setType] = useState<ViewType>('grid')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return

    setLoading(true)
    try {
      const supabase = createClientSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: view, error } = await supabase
        .from('views')
        .insert([
          {
            table_id: params.tableId,
            name,
            type,
            config: {},
            owner_id: user?.id,
            access_level: 'authenticated',
          },
        ])
        .select()
        .single()

      if (error) throw error
      
      router.push(`/data/${params.tableId}/views/${view.id}`)
      router.refresh()
    } catch (error) {
      console.error('Error creating view:', error)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New View</DialogTitle>
          <DialogDescription>
            Choose a name and type for your new view
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">View Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My View"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">View Type</label>
            <Select value={type} onValueChange={(v) => setType(v as ViewType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="calendar">Calendar</SelectItem>
                <SelectItem value="form">Form</SelectItem>
                <SelectItem value="page">Interface Page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? 'Creating...' : 'Create View'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
