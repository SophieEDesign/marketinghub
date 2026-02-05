/**
 * Optional debug telemetry. Only runs when NEXT_PUBLIC_DEBUG_TELEMETRY=1 or true.
 * Never enable in production. Safe to import from client or server.
 */
const DEBUG_TELEMETRY_ENABLED =
  typeof process !== 'undefined' &&
  (process.env?.NEXT_PUBLIC_DEBUG_TELEMETRY === '1' || process.env?.NEXT_PUBLIC_DEBUG_TELEMETRY === 'true')

const TELEMETRY_URL = 'http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a'

export type DebugTelemetryPayload = {
  location: string
  message: string
  data?: Record<string, unknown>
  hypothesisId?: string
}

export function debugTelemetry(payload: DebugTelemetryPayload): void {
  if (!DEBUG_TELEMETRY_ENABLED) return
  const body = JSON.stringify({
    ...payload,
    timestamp: Date.now(),
    sessionId: 'debug-session',
  })
  try {
    fetch(TELEMETRY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {})
  } catch (_) {}
}
