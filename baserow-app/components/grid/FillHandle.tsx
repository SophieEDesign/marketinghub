"use client"

import { useState, useRef, useEffect } from 'react'

interface FillHandleProps {
  onFill: (targetRowIds: string[]) => void
  onDragTargetsChange?: (targetRowIds: Set<string>) => void
  sourceRowId: string
  fieldName: string
  isVisible: boolean
}

export default function FillHandle({
  onFill,
  onDragTargetsChange,
  sourceRowId,
  fieldName,
  isVisible,
}: FillHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [targetRowIds, setTargetRowIds] = useState<Set<string>>(new Set())
  const handleRef = useRef<HTMLDivElement>(null)
  const startRowIndexRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      // Find which cell is under the cursor
      const element = document.elementFromPoint(e.clientX, e.clientY)
      const cellElement = element?.closest('[data-grid-cell="true"]')
      if (cellElement) {
        const rowId = cellElement.getAttribute('data-row-id')
        const cellFieldName = cellElement.getAttribute('data-field-name')
        if (rowId && cellFieldName === fieldName && rowId !== sourceRowId) {
          // Get all row IDs between source and target
          const allCells = document.querySelectorAll(`[data-grid-cell="true"][data-field-name="${fieldName}"]`)
          const sourceIndex = Array.from(allCells).findIndex(cell => 
            cell.getAttribute('data-row-id') === sourceRowId
          )
          const targetIndex = Array.from(allCells).findIndex(cell => 
            cell.getAttribute('data-row-id') === rowId
          )
          
          if (sourceIndex !== -1 && targetIndex !== -1) {
            const start = Math.min(sourceIndex, targetIndex)
            const end = Math.max(sourceIndex, targetIndex)
            const rowIds: string[] = []
            for (let i = start; i <= end; i++) {
              const cell = allCells[i]
              const id = cell.getAttribute('data-row-id')
              if (id && id !== sourceRowId) {
                rowIds.push(id)
              }
            }
            const newTargets = new Set(rowIds)
            setTargetRowIds(newTargets)
            if (onDragTargetsChange) {
              onDragTargetsChange(newTargets)
            }
          }
        }
      }
    }

    const handleMouseUp = () => {
      if (targetRowIds.size > 0) {
        onFill(Array.from(targetRowIds))
      }
      setIsDragging(false)
      setTargetRowIds(new Set())
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, sourceRowId, fieldName, onFill, onDragTargetsChange])

  if (!isVisible) return null

  return (
    <div
      ref={handleRef}
      onMouseDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        setIsDragging(true)
      }}
      className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 border border-blue-600 cursor-crosshair z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600"
      style={{
        clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
      }}
      title="Drag to fill cells below"
    />
  )
}
