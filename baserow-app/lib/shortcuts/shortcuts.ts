/**
 * Centralized Keyboard Shortcut System
 * 
 * Provides a registry-based system for keyboard shortcuts that can be
 * extended without hardcoding. Supports context-aware shortcuts.
 */

export type ShortcutContext = 
  | 'global' 
  | 'interface-edit' 
  | 'grid-view' 
  | 'record-panel' 
  | 'command-palette'

export interface Shortcut {
  id: string
  keys: readonly string[] | string[] // e.g., ['Meta', 'z'] or ['Delete']
  description: string
  action: () => void | Promise<void>
  context: ShortcutContext[]
  preventDefault?: boolean
  stopPropagation?: boolean
}

class ShortcutManager {
  private shortcuts: Map<string, Shortcut> = new Map()
  private activeContexts: Set<ShortcutContext> = new Set(['global'])
  private listeners: Map<string, (event: KeyboardEvent) => void> = new Map()

  /**
   * Register a new shortcut
   */
  register(shortcut: Shortcut): () => void {
    this.shortcuts.set(shortcut.id, shortcut)
    this.setupListener(shortcut)
    
    // Return unregister function
    return () => {
      this.shortcuts.delete(shortcut.id)
      const listener = this.listeners.get(shortcut.id)
      if (listener) {
        window.removeEventListener('keydown', listener)
        this.listeners.delete(shortcut.id)
      }
    }
  }

  /**
   * Set active contexts (determines which shortcuts are active)
   */
  setContexts(contexts: ShortcutContext[]): void {
    this.activeContexts = new Set(contexts)
    // Always include 'global'
    this.activeContexts.add('global')
  }

  /**
   * Add a context
   */
  addContext(context: ShortcutContext): void {
    this.activeContexts.add(context)
  }

  /**
   * Remove a context
   */
  removeContext(context: ShortcutContext): void {
    if (context !== 'global') {
      this.activeContexts.delete(context)
    }
  }

  /**
   * Setup event listener for a shortcut
   */
  private setupListener(shortcut: Shortcut): void {
    const listener = (event: KeyboardEvent) => {
      // Check if shortcut is active in current context
      const isActive = shortcut.context.some(ctx => this.activeContexts.has(ctx))
      if (!isActive) return

      // Check if keys match
      if (this.matchesShortcut(event, shortcut.keys)) {
        if (shortcut.preventDefault) {
          event.preventDefault()
        }
        if (shortcut.stopPropagation) {
          event.stopPropagation()
        }
        shortcut.action()
      }
    }

    this.listeners.set(shortcut.id, listener)
    window.addEventListener('keydown', listener)
  }

  /**
   * Check if keyboard event matches shortcut keys
   */
  private matchesShortcut(event: KeyboardEvent, keys: string[]): boolean {
    const pressedKeys = new Set<string>()

    // Add modifier keys
    if (event.metaKey) pressedKeys.add('Meta')
    if (event.ctrlKey) pressedKeys.add('Control')
    if (event.altKey) pressedKeys.add('Alt')
    if (event.shiftKey) pressedKeys.add('Shift')

    // Add main key
    pressedKeys.add(event.key)

    // Check if all required keys are pressed
    const requiredKeys = new Set(keys)
    if (requiredKeys.size !== pressedKeys.size) return false

    for (const key of requiredKeys) {
      if (!pressedKeys.has(key)) return false
    }

    return true
  }

  /**
   * Get all shortcuts for a given context
   */
  getShortcuts(context?: ShortcutContext): Shortcut[] {
    const contexts = context ? [context, 'global'] : Array.from(this.activeContexts)
    return Array.from(this.shortcuts.values()).filter(shortcut =>
      shortcut.context.some(ctx => contexts.includes(ctx))
    )
  }

  /**
   * Get shortcut by ID
   */
  getShortcut(id: string): Shortcut | undefined {
    return this.shortcuts.get(id)
  }
}

// Singleton instance
export const shortcutManager = new ShortcutManager()

// Common shortcut key combinations
export const ShortcutKeys = {
  UNDO: ['Meta', 'z'],
  REDO: ['Meta', 'Shift', 'z'],
  DUPLICATE: ['Meta', 'd'],
  DELETE: ['Delete'],
  ESCAPE: ['Escape'],
  COMMAND_PALETTE: ['Meta', 'k'],
  SAVE: ['Meta', 's'],
  COPY: ['Meta', 'c'],
  PASTE: ['Meta', 'v'],
  CUT: ['Meta', 'x'],
} as const

// Helper to format shortcut keys for display
export function formatShortcutKeys(keys: string[]): string {
  return keys
    .map(key => {
      switch (key) {
        case 'Meta':
          return '⌘'
        case 'Control':
          return 'Ctrl'
        case 'Alt':
          return 'Alt'
        case 'Shift':
          return '⇧'
        case 'Delete':
          return 'Del'
        case 'Escape':
          return 'Esc'
        default:
          return key.toUpperCase()
      }
    })
    .join(' + ')
}

