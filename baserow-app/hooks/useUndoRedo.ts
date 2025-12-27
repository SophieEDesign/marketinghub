/**
 * Undo/Redo Hook
 * 
 * Provides undo/redo functionality for entity state (layout, blocks, config).
 * Works client-side with optional server sync.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { EntityType } from '@/lib/versioning/versioning'

export interface UndoRedoState<T> {
  past: T[]
  present: T | null
  future: T[]
}

export interface UseUndoRedoOptions {
  maxHistory?: number
  debounceMs?: number
  onStateChange?: (state: any) => void
  syncToServer?: (state: any) => Promise<void>
}

/**
 * Generic undo/redo hook
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions = {}
): {
  state: T | null
  setState: (newState: T, skipHistory?: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clearHistory: () => void
  reset: (newState: T) => void
} {
  const {
    maxHistory = 50,
    debounceMs = 300,
    onStateChange,
    syncToServer,
  } = options

  const [undoRedoState, setUndoRedoState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  })

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isUndoRedoRef = useRef(false)

  // Sync to server (debounced)
  const syncToServerDebounced = useCallback(
    (state: T) => {
      if (!syncToServer) return

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        syncToServer(state).catch((error) => {
          console.error('Failed to sync to server:', error)
        })
      }, debounceMs)
    },
    [syncToServer, debounceMs]
  )

  // Set state (adds to history)
  const setState = useCallback(
    (newState: T, skipHistory: boolean = false) => {
      if (isUndoRedoRef.current) {
        // Don't add to history if this is an undo/redo operation
        setUndoRedoState((prev) => ({
          ...prev,
          present: newState,
        }))
        isUndoRedoRef.current = false
        return
      }

      setUndoRedoState((prev) => {
        if (skipHistory || prev.present === null) {
          return {
            past: prev.past,
            present: newState,
            future: [],
          }
        }

        // Add current state to past
        const newPast = [...prev.past, prev.present]
        // Keep only last maxHistory items
        const trimmedPast =
          newPast.length > maxHistory
            ? newPast.slice(-maxHistory)
            : newPast

        return {
          past: trimmedPast,
          present: newState,
          future: [], // Clear future when new change is made
        }
      })

      // Notify callback
      if (onStateChange) {
        onStateChange(newState)
      }

      // Sync to server (debounced)
      syncToServerDebounced(newState)
    },
    [maxHistory, onStateChange, syncToServerDebounced]
  )

  // Undo
  const undo = useCallback(() => {
    setUndoRedoState((prev) => {
      if (prev.past.length === 0 || prev.present === null) {
        return prev
      }

      const previous = prev.past[prev.past.length - 1]
      const newPast = prev.past.slice(0, -1)
      const newFuture = [prev.present, ...prev.future]

      isUndoRedoRef.current = true

      // Notify callback
      if (onStateChange) {
        onStateChange(previous)
      }

      return {
        past: newPast,
        present: previous,
        future: newFuture,
      }
    })
  }, [onStateChange])

  // Redo
  const redo = useCallback(() => {
    setUndoRedoState((prev) => {
      if (prev.future.length === 0 || prev.present === null) {
        return prev
      }

      const next = prev.future[0]
      const newFuture = prev.future.slice(1)
      const newPast = [...prev.past, prev.present]

      isUndoRedoRef.current = true

      // Notify callback
      if (onStateChange) {
        onStateChange(next)
      }

      return {
        past: newPast,
        present: next,
        future: newFuture,
      }
    })
  }, [onStateChange])

  // Clear history
  const clearHistory = useCallback(() => {
    setUndoRedoState((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }))
  }, [])

  // Reset to new state
  const reset = useCallback(
    (newState: T) => {
      setUndoRedoState({
        past: [],
        present: newState,
        future: [],
      })
      if (onStateChange) {
        onStateChange(newState)
      }
    },
    [onStateChange]
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + Z for undo
      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        if (undoRedoState.past.length > 0) {
          undo()
        }
      }
      // Cmd/Ctrl + Shift + Z for redo
      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && event.shiftKey) {
        event.preventDefault()
        if (undoRedoState.future.length > 0) {
          redo()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, undoRedoState])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    state: undoRedoState.present,
    setState,
    undo,
    redo,
    canUndo: undoRedoState.past.length > 0,
    canRedo: undoRedoState.future.length > 0,
    clearHistory,
    reset,
  }
}

