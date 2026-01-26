"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, ChevronRight, ChevronDown, Calendar, Filter } from "lucide-react"
import type { AutomationRun, AutomationLog } from "@/types/database"
import { formatDistanceToNow } from "date-fns"
import AutomationRunDetails from "./AutomationRunDetails"

interface AutomationRunHistoryProps {
  automationId: string
  limit?: number
}

export default function AutomationRunHistory({ automationId, limit = 50 }: AutomationRunHistoryProps) {
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'running'>('all')

  useEffect(() => {
    loadRuns()
  }, [automationId, filter])

  async function loadRuns() {
    setLoading(true)
    const supabase = createClient()
    
    let query = supabase
      .from('automation_runs')
      .select('*')
      .eq('automation_id', automationId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading runs:', error)
    } else {
      setRuns((data || []) as AutomationRun[])
    }
    
    setLoading(false)
  }

  function getStatusIcon(status: AutomationRun['status']) {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />
      case 'stopped':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  function getStatusBadge(status: AutomationRun['status']) {
    const baseClasses = "px-2 py-0.5 text-xs font-medium rounded"
    switch (status) {
      case 'completed':
        return <span className={`${baseClasses} bg-green-100 text-green-700`}>Completed</span>
      case 'failed':
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>Failed</span>
      case 'running':
        return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>Running</span>
      case 'stopped':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>Stopped</span>
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>{status}</span>
    }
  }

  function formatDuration(started: string, completed?: string) {
    if (!completed) return 'In progress...'
    const start = new Date(started)
    const end = new Date(completed)
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000)
    
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading run history...</span>
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No runs yet</p>
        <p className="text-xs mt-1">Execution history will appear here once the automation runs</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <div className="flex gap-1">
          {(['all', 'completed', 'failed', 'running'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                filter === f
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Runs List */}
      <div className="space-y-2">
        {runs.map((run) => (
          <div
            key={run.id}
            className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
          >
            <button
              onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                {getStatusIcon(run.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(run.status)}
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Started: {new Date(run.started_at).toLocaleString()}
                  {run.completed_at && (
                    <> • Duration: {formatDuration(run.started_at, run.completed_at)}</>
                  )}
                </div>
                {run.error && (
                  <div className="text-xs text-red-600 mt-1 truncate">
                    {run.error}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                {expandedRun === run.id ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>

            {expandedRun === run.id && (
              <div className="border-t border-gray-200 bg-gray-50">
                <AutomationRunDetails runId={run.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
