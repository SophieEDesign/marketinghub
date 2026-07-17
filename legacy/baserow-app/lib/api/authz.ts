import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/roles'

export const ADMIN_REQUIRED_MESSAGE = 'Unauthorized: Admin access required'

export function forbiddenResponse() {
  return NextResponse.json(
    { error: ADMIN_REQUIRED_MESSAGE },
    { status: 403 }
  )
}

export async function requireAdmin() {
  const admin = await isAdmin()
  if (!admin) {
    return { admin: false as const, response: forbiddenResponse() }
  }
  return { admin: true as const, response: null }
}

export function isPermissionDeniedError(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === '42501' ||
        error.code === 'PGRST301' ||
        isPermissionDeniedMessage(error.message || ''))
  )
}

export function isPermissionDeniedMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('permission') ||
    normalized.includes('policy') ||
    normalized.includes('forbidden')
  )
}
