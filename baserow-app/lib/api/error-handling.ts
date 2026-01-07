/**
 * Utility functions for API error handling
 */

export interface ApiError {
  code?: string | number
  message?: string
  details?: string
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
 * Create a standardized error response
 */
export function createErrorResponse(
  error: any,
  defaultMessage: string,
  statusCode: number = 500
) {
  const errorMessage = error?.message || error?.error || defaultMessage
  console.error(defaultMessage, error)
  
  return {
    error: errorMessage,
    ...(error?.code && { code: error.code }),
    ...(error?.details && { details: error.details }),
  }
}

