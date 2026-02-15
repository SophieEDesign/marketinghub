/**
 * Utility functions for API error handling
 */

export interface ApiError {
  code?: string | number
  message?: string
  details?: string
}

/**
 * Check if an error is caused by a request being aborted (navigation/unmount).
 * This is not a real failure and should generally be ignored.
 */
export function isAbortError(error: unknown): boolean {
  if (!error) return false
  
  // Handle DOMException (browser abort errors)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  
  // Handle Error objects with AbortError name
  if (error instanceof Error && error.name === 'AbortError') {
    return true
  }
  
  const errorObj = error as { name?: string; message?: string; details?: string } | null
  const name = errorObj?.name
  if (name === 'AbortError') return true

  // Check message and details for abort-related strings
  const message = String(errorObj?.message || '')
  const details = String(errorObj?.details || '')
  const combined = `${message} ${details}`.toLowerCase()
  
  return (
    message.includes('AbortError') || 
    message.includes('signal is aborted') ||
    details.includes('AbortError') ||
    details.includes('signal is aborted') ||
    combined.includes('abort') && combined.includes('signal')
  )
}

/**
 * Check if an error indicates a table/relation doesn't exist
 */
export function isTableNotFoundError(error: ApiError): boolean {
  const errorCode = error.code || ''
  const errorMessage = error.message || ''
  const errorDetails = error.details || ''
  
  return (
    errorCode === '42P01' ||
    errorCode === 'PGRST116' ||
    errorCode === '404' ||
    errorCode === 404 ||
    errorMessage.includes('relation') ||
    errorMessage.includes('does not exist') ||
    errorMessage.includes('table_fields') ||
    errorDetails.includes('relation') ||
    errorDetails.includes('does not exist') ||
    errorMessage.includes('Table not found')
  )
}

/**
 * Standard API error response shape (for consistency across routes)
 */
export interface ApiErrorResponse {
  error: string
  code?: string | number
  details?: string
}

/**
 * Create a standardized error response object
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string,
  statusCode: number = 500
): ApiErrorResponse {
  const errorObj = error as { message?: string; error?: string; code?: string | number; details?: string } | null
  const errorMessage = errorObj?.message || errorObj?.error || defaultMessage
  if (process.env.NODE_ENV === 'development') {
    console.error(defaultMessage, error)
  }
  return {
    error: errorMessage,
    ...(errorObj?.code && { code: errorObj.code }),
    ...(errorObj?.details && { details: errorObj.details }),
  }
}

/**
 * Use in API routes with NextResponse:
 *   return NextResponse.json(createErrorResponse(error, 'Failed to load', 500), { status: 500 })
 */

