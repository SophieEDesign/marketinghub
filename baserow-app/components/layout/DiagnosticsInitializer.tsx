'use client'

/**
 * Runtime Diagnostics Initializer
 * 
 * Enables window.__DEV_DIAGNOSTICS__ in development mode.
 * This enables detailed logging for page validity, block validity, data resolution, etc.
 */

import { useEffect } from 'react'

export default function DiagnosticsInitializer() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error - window.__DEV_DIAGNOSTICS__ is set at runtime
      window.__DEV_DIAGNOSTICS__ = true
      console.log('[Diagnostics] Runtime diagnostics enabled. Set window.__DEV_DIAGNOSTICS__ = false to disable.')
    }
  }, [])

  return null
}

