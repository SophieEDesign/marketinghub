"use client"

import { useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useSchemaContract } from '@/hooks/useSchemaContract'
import { compareSchemaVersions, fetchSchemaVersion } from '@/lib/schema/contract'
import { createClient } from '@/lib/supabase/client'

export default function SchemaContractInitializer() {
  const { toast } = useToast()
  const { status } = useSchemaContract()
  const warnedRef = useRef(false)
  const versionCheckedRef = useRef(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (!status) return
    if (status.available || warnedRef.current) return

    warnedRef.current = true

    if (status.missingTables.includes('table_fields')) {
      console.error('[schema-contract] table_fields is missing. Schema editing is disabled.')
    } else {
      console.warn('[schema-contract] Missing metadata tables:', status.missingTables)
    }

    toast({
      title: 'Schema editing is unavailable',
      description:
        status.missingTables.length > 0
          ? `Missing metadata tables: ${status.missingTables.join(', ')}.`
          : 'Metadata tables are unavailable.',
    })
  }, [status, toast])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (versionCheckedRef.current) return
    versionCheckedRef.current = true

    const run = async () => {
      const supabase = createClient()
      const actual = await fetchSchemaVersion(supabase)
      const warnings = compareSchemaVersions(actual)
      warnings.forEach((warning) => {
        console.warn('[schema-contract]', warning)
      })
    }

    run()
  }, [])

  return null
}
