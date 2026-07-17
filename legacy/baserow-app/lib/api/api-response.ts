/**
 * Standardized API response helpers for route handlers.
 * Import only in API routes (server-side).
 */

import { NextResponse } from 'next/server'
import { createErrorResponse, type ApiErrorResponse } from './error-handling'

/**
 * Return a standardized error response from API routes.
 * Format: { error: string, code?: string | number, details?: string }
 */
export function apiErrorResponse(
  error: unknown,
  defaultMessage: string,
  statusCode: number = 500
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(createErrorResponse(error, defaultMessage, statusCode), { status: statusCode })
}
