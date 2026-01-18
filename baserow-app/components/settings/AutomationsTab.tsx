"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Play, Pause, Settings } from 'lucide-react'
import type { Automation } from '@/types/database'

export default function SettingsAutomationsTab() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAutomations()
  }, [])

  async function loadAutomations() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading automations:', error)
        // If it's a 500 error, it might be a schema issue - set empty array
        if (error.code === 'PGRST116' || error.message?.includes('500')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Automations table may have schema issues.')
          }
          setAutomations([])
        }
      } else {
        setAutomations((data || []) as Automation[])
      }
    } catch (error) {
      console.error('Error loading automations:', error)
      // Set empty array on any error to prevent UI breakage
      setAutomations([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading automations...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automations</h2>
          <p className="text-muted-foreground mt-1">
            Automate workflows with triggers and actions
          </p>
        </div>
        <Link
          href="/automations/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Automation
        </Link>
      </div>

      {automations.length === 0 ? (
        <div className="text-center py-12 border border-gray-200 rounded-lg">
          <p className="text-gray-500 mb-4">No automations yet</p>
          <Link
            href="/automations/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Your First Automation
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{automation.name}</h3>
                    {automation.enabled ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Enabled
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  {automation.description && (
                    <p className="text-sm text-gray-600 mb-2">{automation.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Trigger: {automation.trigger_type || 'N/A'}</span>
                    <span>Actions: {(automation.actions || []).length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/automations/${automation.id}`}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Edit automation"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

