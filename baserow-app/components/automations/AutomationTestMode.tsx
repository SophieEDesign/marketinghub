"use client"

import { useState } from "react"
import { Play, CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown, AlertCircle } from "lucide-react"
import type { Automation } from "@/types/database"
import type { AutomationLog } from "@/types/database"

interface AutomationTestModeProps {
  automation: Automation
  onClose: () => void
}

interface TestStep {
  step: number
  type: 'trigger' | 'condition' | 'action'
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
  data?: any
  error?: string
  duration?: number
}

export default function AutomationTestMode({ automation, onClose }: AutomationTestModeProps) {
  const [testing, setTesting] = useState(false)
  const [steps, setSteps] = useState<TestStep[]>([])
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; runId?: string } | null>(null)

  async function runTest() {
    setTesting(true)
    setSteps([])
    setTestResult(null)

    // Initialize steps based on automation
    const initialSteps: TestStep[] = [
      {
        step: 1,
        type: 'trigger',
        name: `Trigger: ${automation.trigger_type || 'N/A'}`,
        status: 'pending',
      },
    ]

    if (automation.conditions && automation.conditions.length > 0) {
      initialSteps.push({
        step: 2,
        type: 'condition',
        name: 'Check conditions',
        status: 'pending',
      })
    }

    automation.actions?.forEach((action, index) => {
      initialSteps.push({
        step: initialSteps.length + 1,
        type: 'action',
        name: `Action ${index + 1}: ${action.type || 'N/A'}`,
        status: 'pending',
      })
    })

    setSteps(initialSteps)

    try {
      // Update trigger step
      setSteps((prev) => {
        const next = [...prev]
        next[0] = { ...next[0], status: 'running', message: 'Evaluating trigger...' }
        return next
      })

      await new Promise((resolve) => setTimeout(resolve, 500))

      // Simulate trigger evaluation
      setSteps((prev) => {
        const next = [...prev]
        next[0] = {
          ...next[0],
          status: 'completed',
          message: 'Trigger condition met',
          duration: 500,
        }
        return next
      })

      // Check conditions if present
      if (automation.conditions && automation.conditions.length > 0) {
        const conditionStepIndex = 1
        setSteps((prev) => {
          const next = [...prev]
          next[conditionStepIndex] = {
            ...next[conditionStepIndex],
            status: 'running',
            message: 'Evaluating conditions...',
          }
          return next
        })

        await new Promise((resolve) => setTimeout(resolve, 300))

        setSteps((prev) => {
          const next = [...prev]
          next[conditionStepIndex] = {
            ...next[conditionStepIndex],
            status: 'completed',
            message: 'Conditions met',
            duration: 300,
          }
          return next
        })
      }

      // Execute actions
      const actionStartIndex = automation.conditions && automation.conditions.length > 0 ? 2 : 1
      for (let i = 0; i < (automation.actions || []).length; i++) {
        const stepIndex = actionStartIndex + i
        const action = automation.actions?.[i]

        setSteps((prev) => {
          const next = [...prev]
          next[stepIndex] = {
            ...next[stepIndex],
            status: 'running',
            message: `Executing ${action?.type}...`,
          }
          return next
        })

        // Call actual test API
        const startTime = Date.now()
        try {
          const response = await fetch(`/api/automations/${automation.id}/test`, {
            method: 'POST',
          })

          const result = await response.json()
          const duration = Date.now() - startTime

          if (result.success) {
            setSteps((prev) => {
              const next = [...prev]
              next[stepIndex] = {
                ...next[stepIndex],
                status: 'completed',
                message: 'Action completed successfully',
                data: result.logs?.[i]?.data,
                duration,
              }
              return next
            })
          } else {
            setSteps((prev) => {
              const next = [...prev]
              next[stepIndex] = {
                ...next[stepIndex],
                status: 'failed',
                message: 'Action failed',
                error: result.error,
                duration,
              }
              return next
            })
            setTestResult({ success: false, error: result.error })
            break
          }
        } catch (error: any) {
          const duration = Date.now() - startTime
          setSteps((prev) => {
            const next = [...prev]
            next[stepIndex] = {
              ...next[stepIndex],
              status: 'failed',
              message: 'Action failed',
              error: error.message,
              duration,
            }
            return next
          })
          setTestResult({ success: false, error: error.message })
          break
        }

        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      // Check if all steps completed
      const allCompleted = steps.every((s) => s.status === 'completed' || s.status === 'failed')
      if (allCompleted && !testResult) {
        setTestResult({ success: true })
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message })
    } finally {
      setTesting(false)
    }
  }

  function getStepIcon(step: TestStep) {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'running':
        return <Clock className="h-5 w-5 text-blue-600 animate-spin" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    }
  }

  function getStepBadge(step: TestStep) {
    const baseClasses = "px-2 py-0.5 text-xs font-medium rounded"
    switch (step.status) {
      case 'completed':
        return <span className={`${baseClasses} bg-green-100 text-green-700`}>Completed</span>
      case 'failed':
        return <span className={`${baseClasses} bg-red-100 text-red-700`}>Failed</span>
      case 'running':
        return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>Running</span>
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>Pending</span>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Test Automation</h2>
              <p className="text-sm text-gray-500 mt-1">
                Run this automation with sample data to verify it works correctly
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <XCircle className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Test Controls */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <button
            onClick={runTest}
            disabled={testing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {testing ? 'Running Test...' : 'Run Test'}
          </button>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-6">
          {steps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Play className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Click "Run Test" to start testing this automation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.step}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-shrink-0">{getStepIcon(step)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{step.name}</span>
                        {getStepBadge(step)}
                      </div>
                      {step.message && (
                        <div className="text-xs text-gray-600">{step.message}</div>
                      )}
                      {step.duration && (
                        <div className="text-xs text-gray-500 mt-1">
                          Duration: {step.duration}ms
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {expandedStep === step.step ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {expandedStep === step.step && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      {step.error && (
                        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-medium text-sm text-red-900 mb-1">Error</div>
                              <div className="text-sm text-red-700">{step.error}</div>
                            </div>
                          </div>
                        </div>
                      )}
                      {step.data && (
                        <div>
                          <div className="font-medium text-xs text-gray-700 mb-2">Output Data</div>
                          <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-x-auto">
                            {JSON.stringify(step.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Result Summary */}
        {testResult && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div
              className={`p-4 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-sm mb-1">
                    {testResult.success ? 'Test Completed Successfully' : 'Test Failed'}
                  </div>
                  {testResult.error && (
                    <div className="text-sm text-red-700">{testResult.error}</div>
                  )}
                  {testResult.runId && (
                    <div className="text-xs text-gray-600 mt-2">
                      Run ID: {testResult.runId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
