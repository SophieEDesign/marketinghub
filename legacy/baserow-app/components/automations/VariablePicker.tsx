"use client"

import { useState } from "react"
import { Search, X, Copy, Check } from "lucide-react"
import type { TableField } from "@/types/database"

interface VariablePickerProps {
  tableFields: TableField[]
  triggerData?: Record<string, any>
  actionResults?: Record<string, any>
  onInsert: (variable: string) => void
  onClose: () => void
}

export default function VariablePicker({
  tableFields,
  triggerData,
  actionResults,
  onInsert,
  onClose,
}: VariablePickerProps) {
  const [search, setSearch] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  const variables: Array<{ name: string; value: string; category: string; description?: string }> = []

  // Add trigger record fields
  if (tableFields.length > 0) {
    tableFields.forEach((field) => {
      variables.push({
        name: field.name,
        value: `{{${field.name}}}`,
        category: 'Trigger Record',
        description: `Value from the ${field.name} field in the triggered record`,
      })
    })
  }

  // Add special variables
  variables.push(
    {
      name: 'Record ID',
      value: '{{record_id}}',
      category: 'Special',
      description: 'The ID of the record that triggered this automation',
    },
    {
      name: 'Table ID',
      value: '{{table_id}}',
      category: 'Special',
      description: 'The ID of the table containing the triggered record',
    },
    {
      name: 'Current Date',
      value: '{{NOW()}}',
      category: 'Special',
      description: 'The current date and time',
    },
    {
      name: 'Current User',
      value: '{{USER()}}',
      category: 'Special',
      description: 'The user who triggered this automation',
    }
  )

  // Add action results
  if (actionResults) {
    Object.entries(actionResults).forEach(([key, value]) => {
      variables.push({
        name: key,
        value: `{{${key}}}`,
        category: 'Action Results',
        description: `Result from a previous action: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`,
      })
    })
  }

  const filteredVariables = variables.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.value.toLowerCase().includes(search.toLowerCase())
  )

  const groupedVariables = filteredVariables.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = []
    acc[v.category].push(v)
    return acc
  }, {} as Record<string, typeof variables>)

  function handleInsert(variable: string) {
    onInsert(variable)
    setCopied(variable)
    setTimeout(() => {
      setCopied(null)
      onClose()
    }, 500)
  }

  function handleCopy(variable: string, e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(variable)
    setCopied(variable)
    setTimeout(() => setCopied(null), 1000)
  }

  return (
    <div className="absolute z-50 w-96 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Insert Variable</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variables..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(groupedVariables).length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No variables found
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(groupedVariables).map(([category, vars]) => (
              <div key={category} className="mb-4">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {category}
                </div>
                <div className="space-y-1">
                  {vars.map((variable) => (
                    <button
                      key={variable.value}
                      onClick={() => handleInsert(variable.value)}
                      className="w-full flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-blue-700">
                            {variable.value}
                          </code>
                          {copied === variable.value && (
                            <Check className="h-3 w-3 text-green-600" />
                          )}
                        </div>
                        <div className="text-xs text-gray-600">{variable.name}</div>
                        {variable.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{variable.description}</div>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleCopy(variable.value, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                        title="Copy to clipboard"
                      >
                        <Copy className="h-3 w-3 text-gray-400" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500">
          Click a variable to insert it, or use the copy button to copy the variable name
        </p>
      </div>
    </div>
  )
}
