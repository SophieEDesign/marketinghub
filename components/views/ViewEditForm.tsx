'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import type { View } from '@/types/database'

interface ViewEditFormProps {
  view: View
  tableId: string
}

export default function ViewEditForm({ view, tableId }: ViewEditFormProps) {
  const router = useRouter()
  const [name, setName] = useState(view.name)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const supabase = createClientSupabaseClient()
    const { error } = await supabase
      .from('views')
      .update({ name })
      .eq('id', view.id)

    if (!error) {
      router.push(`/tables/${tableId}/views/${view.id}`)
      router.refresh()
    } else {
      setSaving(false)
    }
  }

  async function handleDuplicate() {
    const { duplicateView } = await import('@/lib/views')
    const newView = await duplicateView(view.id)
    if (newView) {
      router.push(`/tables/${tableId}/views/${newView.id}`)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">View Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button variant="outline" onClick={handleDuplicate}>
          Duplicate View
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/tables/${tableId}/views/${view.id}`}>Cancel</Link>
        </Button>
      </div>
    </div>
  )
}
