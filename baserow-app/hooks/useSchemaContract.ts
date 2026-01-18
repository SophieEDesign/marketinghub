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

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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

  return {
    status,
    loading,
    schemaAvailable: status?.available === true,
  }
}
