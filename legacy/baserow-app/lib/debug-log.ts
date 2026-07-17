import path from 'path'
import fs from 'fs'

export function debugLog(payload: { location: string; message: string; data?: Record<string, unknown>; hypothesisId?: string }) {
  const entry = { ...payload, timestamp: Date.now(), sessionId: 'debug-session' }
  try {
    const logDir = path.join(process.cwd(), '.cursor')
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    const logPath = path.join(logDir, 'debug.log')
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n')
  } catch (_) {}
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.log('[debug]', entry.location, entry.message, entry.data ?? '')
  }
}
