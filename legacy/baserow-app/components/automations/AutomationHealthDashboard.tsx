"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react"
import type { Automation, AutomationRun } from "@/types/database"
import { formatDistanceToNow } from "date-fns"

interface AutomationHealthDashboardProps {
  automations: Automation[]
}

interface AutomationHealth {
  automationId: string
  automationName: string
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  successRate: number
  averageDuration: number
  lastRun?: AutomationRun
  healthScore: number // 0-100
  status: 'healthy' | 'warning' | 'critical'
}

export default function AutomationHealthDashboard({ automations }: AutomationHealthDashboardProps) {
  const [healthData, setHealthData] = useState<AutomationHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  useEffect(() => {
    loadHealthData()
  }, [automations, timeRange])

  async function loadHealthData() {
    setLoading(true)
    const supabase = createClient()
    const now = new Date()
    const timeRangeMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[timeRange]
    const since = new Date(now.getTime() - timeRangeMs)

    const healthPromises = automations.map(async (automation) => {
      // Get runs in time range
      const { data: runs } = await supabase
        .from('automation_runs')
        .select('*')
        .eq('automation_id', automation.id)
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: false })

      const runsList = (runs || []) as AutomationRun[]
      const totalRuns = runsList.length
      const successfulRuns = runsList.filter(r => r.status === 'completed').length
      const failedRuns = runsList.filter(r => r.status === 'failed').length
      const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 100

      // Calculate average duration
      const completedRuns = runsList.filter(r => r.status === 'completed' && r.completed_at)
      const avgDuration = completedRuns.length > 0
        ? completedRuns.reduce((sum, run) => {
            const duration = new Date(run.completed_at!).getTime() - new Date(run.started_at).getTime()
            return sum + duration
          }, 0) / completedRuns.length
        : 0

      // Calculate health score (0-100)
      let healthScore = 100
      if (totalRuns > 0) {
        healthScore = successRate // Base score on success rate
        if (failedRuns > 0 && totalRuns < 10) {
          healthScore -= 20 // Penalty for failures in low-volume automations
        }
        if (successRate < 50) {
          healthScore -= 30 // Additional penalty for very low success rate
        }
      }
      healthScore = Math.max(0, Math.min(100, healthScore))

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (healthScore < 50) {
        status = 'critical'
      } else if (healthScore < 80 || (failedRuns > 0 && totalRuns > 5)) {
        status = 'warning'
      }

      return {
        automationId: automation.id,
        automationName: automation.name,
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate,
        averageDuration: avgDuration,
        lastRun: runsList[0],
        healthScore,
        status,
      }
    })

    const health = await Promise.all(healthPromises)
    setHealthData(health.sort((a, b) => b.healthScore - a.healthScore))
    setLoading(false)
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  function getHealthIcon(status: AutomationHealth['status']) {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />
    }
  }

  function getHealthColor(score: number): string {
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Calculate overall stats
  const overallStats = healthData.reduce(
    (acc, h) => ({
      totalRuns: acc.totalRuns + h.totalRuns,
      successfulRuns: acc.successfulRuns + h.successfulRuns,
      failedRuns: acc.failedRuns + h.failedRuns,
      avgHealthScore: acc.avgHealthScore + h.healthScore,
    }),
    { totalRuns: 0, successfulRuns: 0, failedRuns: 0, avgHealthScore: 0 }
  )

  const overallSuccessRate = overallStats.totalRuns > 0
    ? (overallStats.successfulRuns / overallStats.totalRuns) * 100
    : 100
  const avgHealthScore = healthData.length > 0
    ? overallStats.avgHealthScore / healthData.length
    : 100

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Activity className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading health data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Automation Health</h2>
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                timeRange === range
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Total Runs</div>
          <div className="text-2xl font-bold">{overallStats.totalRuns}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Success Rate</div>
          <div className="text-2xl font-bold text-green-600">
            {overallSuccessRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Failed Runs</div>
          <div className="text-2xl font-bold text-red-600">{overallStats.failedRuns}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-1">Avg Health Score</div>
          <div className={`text-2xl font-bold ${getHealthColor(avgHealthScore)}`}>
            {avgHealthScore.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Automation Health List */}
      <div className="space-y-3">
        {healthData.map((health) => (
          <div
            key={health.automationId}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getHealthIcon(health.status)}
                  <h3 className="font-semibold">{health.automationName}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getHealthColor(health.healthScore)} bg-opacity-10`}>
                    {health.healthScore.toFixed(0)}% health
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Runs</div>
                    <div className="font-medium">{health.totalRuns}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Success Rate</div>
                    <div className={`font-medium ${health.successRate >= 80 ? 'text-green-600' : health.successRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {health.successRate.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Avg Duration</div>
                    <div className="font-medium">
                      {health.averageDuration > 0 ? formatDuration(health.averageDuration) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Last Run</div>
                    <div className="font-medium text-xs">
                      {health.lastRun
                        ? formatDistanceToNow(new Date(health.lastRun.started_at), { addSuffix: true })
                        : 'Never'}
                    </div>
                  </div>
                </div>
                {health.failedRuns > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    {health.failedRuns} failed run{health.failedRuns !== 1 ? 's' : ''} in the last {timeRange}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {healthData.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No automation runs found in the selected time range</p>
        </div>
      )}
    </div>
  )
}
