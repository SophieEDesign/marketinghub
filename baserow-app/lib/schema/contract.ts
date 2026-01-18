import type { SupabaseClient } from '@supabase/supabase-js'
import { isTableNotFoundError } from '@/lib/api/error-handling'

export const REQUIRED_SCHEMA_TABLES = [
  { name: 'tables', aliases: [] },
  { name: 'table_fields', aliases: [] },
  // Support legacy naming if applicable.
  { name: 'views', aliases: ['table_views'] },
  { name: 'view_fields', aliases: ['table_view_fields'] },
] as const

export type SchemaTableName = (typeof REQUIRED_SCHEMA_TABLES)[number]['name']

export interface SchemaContractStatus {
  available: boolean
  missingTables: SchemaTableName[]
  checkedAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000

let cachedStatus: SchemaContractStatus | null = null
let cachedAt = 0
let inFlightPromise: Promise<SchemaContractStatus> | null = null

export async function checkSchemaContract(
  supabase: SupabaseClient,
  opts?: { force?: boolean }
): Promise<SchemaContractStatus> {
  const now = Date.now()
  const force = opts?.force === true

  if (!force && cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return cachedStatus
  }

  if (!force && inFlightPromise) {
    return inFlightPromise
  }

  inFlightPromise = (async () => {
    const missingTables: SchemaTableName[] = []

    for (const table of REQUIRED_SCHEMA_TABLES) {
      const candidates = [table.name, ...table.aliases]
      let found = false

      for (const candidate of candidates) {
        const { error } = await supabase.from(candidate).select('id').limit(1)
        if (!error) {
          found = true
          break
        }

        if (error && !isTableNotFoundError(error)) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[schema-contract] Non-fatal metadata check error:', {
              tableName: candidate,
              code: (error as any)?.code,
              message: (error as any)?.message,
            })
          }
          // Non-fatal errors should not mark schema as missing.
          found = true
          break
        }
      }

      if (!found) {
        missingTables.push(table.name)
      }
    }

    const status: SchemaContractStatus = {
      available: missingTables.length === 0,
      missingTables,
      checkedAt: Date.now(),
    }

    cachedStatus = status
    cachedAt = Date.now()
    inFlightPromise = null
    return status
  })()

  return inFlightPromise
}

export function getCachedSchemaContractStatus(): SchemaContractStatus | null {
  if (!cachedStatus) return null
  if (Date.now() - cachedAt >= CACHE_TTL_MS) return null
  return cachedStatus
}

export async function fetchSchemaVersion(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_schema_version')
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[schema-contract] Schema version check unavailable:', {
          code: (error as any)?.code,
          message: (error as any)?.message,
        })
      }
      return null
    }
    if (data == null) return null
    return String(data)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[schema-contract] Schema version check failed:', error)
    }
    return null
  }
}

export function compareSchemaVersions(actual: string | null) {
  const expected = process.env.NEXT_PUBLIC_SCHEMA_VERSION || null
  const production = process.env.NEXT_PUBLIC_PRODUCTION_SCHEMA_VERSION || null

  const isNumeric = (value: string | null) => value != null && /^\d+$/.test(value)
  const normalize = (value: string | null) => (value ? value.trim() : null)

  const normalizedActual = normalize(actual)
  const normalizedExpected = normalize(expected)
  const normalizedProduction = normalize(production)

  const warnings: string[] = []

  if (normalizedExpected && normalizedActual && normalizedExpected !== normalizedActual) {
    warnings.push(`Expected schema version ${normalizedExpected}, got ${normalizedActual}.`)
    if (isNumeric(normalizedExpected) && isNumeric(normalizedActual)) {
      if (Number(normalizedActual) < Number(normalizedExpected)) {
        warnings.push('Migration history appears incomplete for this environment.')
      }
    }
  }

  if (normalizedProduction && normalizedActual && normalizedProduction !== normalizedActual) {
    warnings.push(`Local schema version ${normalizedActual} differs from production ${normalizedProduction}.`)
  }

  return warnings
}
