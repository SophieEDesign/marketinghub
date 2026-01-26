"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Copy, Check, ExternalLink, RefreshCw, Calendar, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface WebhookManagerProps {
  webhookId: string
  automationId: string
}

interface WebhookCall {
  id: string
  automation_id: string
  webhook_id: string
  method: string
  headers: Record<string, string>
  body: any
  response_status?: number
  response_body?: any
  error?: string
  created_at: string
}

export default function WebhookManager({ webhookId, automationId }: WebhookManagerProps) {
  const [copied, setCopied] = useState(false)
  const [calls, setCalls] = useState<WebhookCall[]>([])
  const [loading, setLoading] = useState(true)

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/hooks/${webhookId}`

  useEffect(() => {
    loadWebhookCalls()
  }, [webhookId])

  async function loadWebhookCalls() {
    // Note: This would require a webhook_calls table in the database
    // For now, we'll show a placeholder
    setLoading(false)
    // In a real implementation, you'd fetch from a webhook_calls table
    // const { data } = await supabase
    //   .from('webhook_calls')
    //   .select('*')
    //   .eq('webhook_id', webhookId)
    //   .order('created_at', { ascending: false })
    //   .limit(50)
  }

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function testWebhook() {
    // Open webhook URL in new tab for testing
    window.open(webhookUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <div>
        <label className="block text-sm font-medium mb-2">Webhook URL</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={webhookUrl}
            readOnly
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 font-mono"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
            title="Copy webhook URL"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span className="text-sm">Copy</span>
              </>
            )}
          </button>
          <button
            onClick={testWebhook}
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
            title="Test webhook"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="text-sm">Test</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Send POST requests to this URL to trigger the automation
        </p>
      </div>

      {/* Security Settings */}
      <div>
        <label className="block text-sm font-medium mb-2">Security</label>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-yellow-900 mb-1">
                Webhook Security
              </div>
              <div className="text-sm text-yellow-800">
                This webhook is publicly accessible. Consider adding authentication or IP whitelisting in production.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium">Call History</label>
          <button
            onClick={loadWebhookCalls}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading call history...
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No webhook calls yet</p>
            <p className="text-xs mt-1">Call history will appear here once the webhook is triggered</p>
          </div>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <div
                key={call.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                      {call.method}
                    </span>
                    {call.response_status && (
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          call.response_status >= 200 && call.response_status < 300
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {call.response_status}
                      </span>
                    )}
                    {call.error && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                        Error
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                  </span>
                </div>
                {call.error && (
                  <div className="text-xs text-red-600 mb-2">{call.error}</div>
                )}
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    View details
                  </summary>
                  <div className="mt-2 space-y-2">
                    {call.body && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Request Body</div>
                        <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">
                          {JSON.stringify(call.body, null, 2)}
                        </pre>
                      </div>
                    )}
                    {call.response_body && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Response</div>
                        <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">
                          {JSON.stringify(call.response_body, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
