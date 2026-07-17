'use client'

import { useEffect } from 'react'

/**
 * Filters out known browser extension errors from the console
 * These errors are harmless and come from extensions that don't properly handle
 * async message responses. They don't affect the application functionality.
 */
export default function ConsoleErrorFilter() {
  useEffect(() => {
    // Filter extension errors by default (they're never useful)
    // Set NEXT_PUBLIC_FILTER_EXTENSION_ERRORS=false to disable filtering
    const shouldFilter = process.env.NEXT_PUBLIC_FILTER_EXTENSION_ERRORS !== 'false'

    if (!shouldFilter) {
      return
    }

    // Store original error handlers
    const originalError = console.error
    const originalWarn = console.warn

    // Patterns to filter (browser extension errors)
    const extensionErrorPatterns = [
      /A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received/,
      /Unchecked runtime\.lastError/,
      /Extension context invalidated/,
      /message channel closed/,
    ]

    // Filter console.error
    console.error = (...args: any[]) => {
      const message = args.join(' ')
      const shouldFilter = extensionErrorPatterns.some(pattern => pattern.test(message))
      
      if (!shouldFilter) {
        originalError.apply(console, args)
      }
    }

    // Filter console.warn for similar messages
    console.warn = (...args: any[]) => {
      const message = args.join(' ')
      const shouldFilter = extensionErrorPatterns.some(pattern => pattern.test(message))
      
      if (!shouldFilter) {
        originalWarn.apply(console, args)
      }
    }

    // Filter unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || String(event.reason || '')
      const shouldFilter = extensionErrorPatterns.some(pattern => pattern.test(message))
      
      if (shouldFilter) {
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Cleanup
    return () => {
      console.error = originalError
      console.warn = originalWarn
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
