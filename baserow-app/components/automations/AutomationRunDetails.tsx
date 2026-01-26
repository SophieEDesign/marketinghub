"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2, XCircle, Info, AlertTriangle, Clock } from "lucide-react"
import type { AutomationLog } from "@/types/database"

interface AutomationRunDetailsProps {
  runId: string
}

export default function AutomationRunDetails({ runId }: AutomationRunDetailsProps) {
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<any>(null)

  useEffect(() => {
    loadDetails()
  }, [runId])

  async function loadDetails() {
    setLoading(true)
    const supabase = createClient()

    // Load logs
    const { data: logsData } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })

    // Load run context
    const { data: runData } = await supabase
      .from('automation_runs')
      .select('context')
      .eq('id', runId)
      .single()

    setLogs((logsData || []) as AutomationLog[])
    setContext(runData?.context || null)
    setLoading(false)
  }

  function getLogIcon(level: AutomationLog['level']) {
    switch (level) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Info className="h-4 w-4 text-gray-400" />
    }
  }

  function getLogBadge(level: AutomationLog['level']) {
    const baseClasses = "px-2 py-0.5 text-xs font-medium rounded"
    switch (level) {
      case 'info':
        return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>Info</span>
      case 'warning':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>Warning</span>
      case 'error':
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>Error</span>
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>{level}</span>
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        <Clock className="h-4 w-4 animate-spin mx-auto mb-2" />
        Loading details...
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Context */}
      {context && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Trigger Context</h4>
          <div className="bg-white border border-gray-200 rounded p-3 text-xs font-mono overflow-x-auto">
            <pre>{JSON.stringify(context, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Logs */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Execution Log</h4>
        {logs.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No log entries for this run
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getLogIcon(log.level)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getLogBadge(log.level)}
                    <span className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700">{log.message}</div>
                  {log.data && Object.keys(log.data).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        View data
                      </summary>
                      <div className="mt-1 bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono overflow-x-auto">
                        <pre>{JSON.stringify(log.data, null, 2)}</pre>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
