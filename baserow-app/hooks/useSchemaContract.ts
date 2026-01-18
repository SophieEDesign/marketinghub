import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  checkSchemaContract,
  getCachedSchemaContractStatus,
  type SchemaContractStatus,
} from '@/lib/schema/contract'

export function useSchemaContract() {
  const [status, setStatus] = useState<SchemaContractStatus | null>(() => getCachedSchemaContractStatus())
  const [loading, setLoading] = useState(status == null)
  const mountedRef = useRef(true)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const cached = getCachedSchemaContractStatus()
    if (cached) {
      setStatus(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const nextStatus = await checkSchemaContract(supabase)
        if (!cancelled && mountedRef.current) {
          setStatus(nextStatus)
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!status) return
    if (status.available) {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
      return
    }
    if (refreshTimeoutRef.current) return

    // Self-heal: retry schema contract in the background.
    refreshTimeoutRef.current = setTimeout(async () => {
      refreshTimeoutRef.current = null
      try {
        const supabase = createClient()
        const nextStatus = await checkSchemaContract(supabase, { force: true })
        if (mountedRef.current) {
          setStatus(nextStatus)
        }
      } catch {
        // Non-fatal; keep current status and retry later.
      }
    }, 15000)
  }, [status])

  return {
    status,
    loading,
    schemaAvailable: status?.available === true,
  }
}
