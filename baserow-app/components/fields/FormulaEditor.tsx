"use client"

import { useState, useEffect, useRef } from "react"
import { Calculator, AlertCircle, CheckCircle } from "lucide-react"
import { validateFormula } from "@/lib/formulas/computeFormulaFields"
import type { TableField } from "@/types/fields"

interface FormulaEditorProps {
  value: string
  onChange: (value: string) => void
  tableFields: TableField[]
  onPreview?: (result: string | null) => void
}

const FUNCTION_HINTS = [
  'CONCAT', 'UPPER', 'LOWER', 'LEFT', 'RIGHT', 'LEN',
  'FIND', 'SUBSTITUTE', 'ROUND', 'FLOOR', 'CEILING',
  'IF', 'SWITCH', 'DATEADD', 'DATETIME_FORMAT', 'NOW', 'TODAY'
]

export default function FormulaEditor({
  value,
  onChange,
  tableFields,
  onPreview,
}: FormulaEditorProps) {
  const [validation, setValidation] = useState<{ valid: boolean; error?: string }>({ valid: true })
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([])
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [previewResult, setPreviewResult] = useState<string | null>(null)

  useEffect(() => {
    const result = validateFormula(value)
    setValidation(result)
    
    if (onPreview) {
      // Simple preview - just show validation status for now
      // Full evaluation would require row data
      onPreview(result.valid ? "Valid formula" : null)
    }
  }, [value, onPreview])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value
    onChange(newValue)
    
    const cursorPos = e.target.selectionStart || 0
    setCursorPosition(cursorPos)

    // Check if we should show autocomplete
    const textBeforeCursor = newValue.substring(0, cursorPos)
    const lastChar = textBeforeCursor[textBeforeCursor.length - 1]

    if (lastChar === '{') {
      // Show field autocomplete
      const fieldNames = tableFields
        .filter(f => f.type !== 'formula')
        .map(f => f.name)
      setAutocompleteItems(fieldNames)
      setShowAutocomplete(true)
      setAutocompleteIndex(0)
    } else if (/[A-Za-z]/.test(lastChar)) {
      // Check if typing function name
      const wordMatch = textBeforeCursor.match(/([A-Za-z]+)$/)
      if (wordMatch) {
        const word = wordMatch[1].toUpperCase()
        const matchingFunctions = FUNCTION_HINTS.filter(f => 
          f.startsWith(word)
        )
        if (matchingFunctions.length > 0) {
          setAutocompleteItems(matchingFunctions)
          setShowAutocomplete(true)
          setAutocompleteIndex(0)
        } else {
          setShowAutocomplete(false)
        }
      } else {
        setShowAutocomplete(false)
      }
    } else {
      setShowAutocomplete(false)
    }
  }

  function insertAutocomplete(item: string) {
    if (!textareaRef.current) return

    const text = value
    const beforeCursor = text.substring(0, cursorPosition)
    const afterCursor = text.substring(cursorPosition)

    let insertText = item
    let newCursorPos = cursorPosition + insertText.length

    // If we're in a field reference context
    if (beforeCursor.endsWith('{')) {
      insertText = item + '}'
      newCursorPos = cursorPosition + item.length + 1
    }

    const newValue = beforeCursor + insertText + afterCursor
    onChange(newValue)

    // Set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        textareaRef.current.focus()
      }
    }, 0)

    setShowAutocomplete(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showAutocomplete && autocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocompleteIndex((i) => (i + 1) % autocompleteItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocompleteIndex((i) => (i - 1 + autocompleteItems.length) % autocompleteItems.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertAutocomplete(autocompleteItems[autocompleteIndex])
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false)
      }
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Formula Expression</label>
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={`w-full px-3 py-2 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            !validation.valid ? 'border-red-300' : 'border-gray-300'
          }`}
          rows={6}
          placeholder='e.g., {Field 1} + {Field 2}'
        />
        
        {/* Autocomplete dropdown */}
        {showAutocomplete && autocompleteItems.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-auto">
            {autocompleteItems.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => insertAutocomplete(item)}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 ${
                  index === autocompleteIndex ? 'bg-blue-100' : ''
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Validation message */}
      {!validation.valid && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{validation.error || 'Invalid formula syntax'}</span>
        </div>
      )}

      {validation.valid && value.trim() && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Valid formula</span>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>Field references:</strong> Use {"{Field Name}"} to reference other fields
        </p>
        <p>
          <strong>Functions:</strong> {FUNCTION_HINTS.slice(0, 5).join(', ')}, ...
        </p>
        <p>
          <strong>Operators:</strong> +, -, *, /, =, !=, &gt;, &lt;, AND, OR
        </p>
      </div>
    </div>
  )
}
