/**
 * React hook for managing keyboard shortcuts
 */

import { useEffect, useRef } from 'react'
import { shortcutManager, type Shortcut, type ShortcutContext } from '@/lib/shortcuts/shortcuts'

export function useShortcuts(
  shortcuts: Shortcut[],
  contexts?: ShortcutContext[]
) {
  const unregisterRef = useRef<Array<() => void>>([])

  useEffect(() => {
    // Set contexts if provided
    if (contexts) {
      shortcutManager.setContexts(contexts)
    }

    // Register all shortcuts
    const unregisterFunctions = shortcuts.map(shortcut =>
      shortcutManager.register(shortcut)
    )

    unregisterRef.current = unregisterFunctions

    // Cleanup on unmount
    return () => {
      unregisterFunctions.forEach(unregister => unregister())
    }
  }, []) // Only run once on mount

  // Update contexts when they change
  useEffect(() => {
    if (contexts) {
      shortcutManager.setContexts(contexts)
    }
  }, [contexts])
}

/**
 * Hook to set active contexts
 */
export function useShortcutContext(contexts: ShortcutContext[]) {
  useEffect(() => {
    shortcutManager.setContexts(contexts)
    
    return () => {
      // Reset to global only on unmount
      shortcutManager.setContexts(['global'])
    }
  }, [contexts])
}

