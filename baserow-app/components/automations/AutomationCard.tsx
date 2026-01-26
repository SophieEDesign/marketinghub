"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Settings, Copy, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react"
import type { Automation, AutomationRun } from "@/types/database"
import DuplicateAutomationButton from "./DuplicateAutomationButton"
import { formatDistanceToNow } from "date-fns"

interface AutomationCardProps {
  automation: Automation
}

export default function AutomationCard({ automation }: AutomationCardProps) {
  const [lastRun, setLastRun] = useState<AutomationRun | null>(null)
  const [runStats, setRunStats] = useState<{ total: number; success: number; failed: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [automation.id])

  async function loadStats() {
    const supabase = createClient()
    
    // Get last run
    const { data: lastRunData } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('automation_id', automation.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get run stats (last 30 runs)
    const { data: recentRuns } = await supabase
      .from('automation_runs')
      .select('status')
      .eq('automation_id', automation.id)
      .order('started_at', { ascending: false })
      .limit(30)

    if (lastRunData) {
      setLastRun(lastRunData as AutomationRun)
    }

    if (recentRuns) {
      const total = recentRuns.length
      const success = recentRuns.filter(r => r.status === 'completed').length
      const failed = recentRuns.filter(r => r.status === 'failed').length
      setRunStats({ total, success, failed })
    }

    setLoading(false)
  }

  function getLastRunStatusIcon() {
    if (!lastRun) return null
    
    switch (lastRun.status) {
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 text-green-600" />
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-600" />
      case 'running':
        return <Clock className="h-3 w-3 text-blue-600 animate-spin" />
      case 'stopped':
        return <AlertCircle className="h-3 w-3 text-yellow-600" />
      default:
        return null
    }
  }

  function getSuccessRate() {
    if (!runStats || runStats.total === 0) return null
    const rate = Math.round((runStats.success / runStats.total) * 100)
    return rate
  }

  function getTriggerLabel(triggerType?: string) {
    const labels: Record<string, string> = {
      'row_created': 'Record created',
      'row_updated': 'Record updated',
      'row_deleted': 'Record deleted',
      'schedule': 'Scheduled',
      'webhook': 'Webhook',
      'condition': 'Condition match',
    }
    return labels[triggerType || ''] || triggerType || 'N/A'
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors bg-white">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold truncate">{automation.name}</h3>
            {automation.enabled ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded flex-shrink-0">
                Active
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded flex-shrink-0">
                Paused
              </span>
            )}
            {lastRun && lastRun.status === 'failed' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded flex-shrink-0">
                Error
              </span>
            )}
          </div>
          
          {automation.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{automation.description}</p>
          )}
          
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Trigger:</span>
                        {getTriggerLabel(automation.trigger_type)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Actions:</span>
                        {(automation.actions || []).length}
                      </span>
                      {automation.category && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          {automation.category}
                        </span>
                      )}
                      {automation.tags && automation.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {automation.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                          {automation.tags.length > 3 && (
                            <span className="text-gray-500 text-xs">
                              +{automation.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

          {!loading && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {lastRun ? (
                <div className="flex items-center gap-1.5">
                  {getLastRunStatusIcon()}
                  <span>
                    Last run: {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true })}
                  </span>
                </div>
              ) : (
                <span className="text-gray-400">No runs yet</span>
              )}
              
              {runStats && runStats.total > 0 && (
                <>
                  <span>•</span>
                  <span>
                    {runStats.success}/{runStats.total} successful
                    {getSuccessRate() !== null && (
                      <span className="text-gray-400"> ({getSuccessRate()}%)</span>
                    )}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <DuplicateAutomationButton automation={automation} />
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
  )
}
