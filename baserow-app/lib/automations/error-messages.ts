/**
 * Converts technical error messages into user-friendly messages with suggestions
 */

export interface UserFriendlyError {
  message: string
  suggestion?: string
  code?: string
}

export function getUserFriendlyError(error: any, context?: {
  actionType?: string
  triggerType?: string
  fieldName?: string
  tableId?: string
}): UserFriendlyError {
  const errorMessage = error?.message || String(error) || 'An unexpected error occurred'
  const lowerMessage = errorMessage.toLowerCase()

  // Table/Record errors
  if (lowerMessage.includes('table_id') && lowerMessage.includes('required')) {
    return {
      message: 'Please select a table for this action',
      suggestion: 'Make sure you\'ve selected a table in the action configuration',
      code: 'MISSING_TABLE'
    }
  }

  if (lowerMessage.includes('record_id') && lowerMessage.includes('required')) {
    return {
      message: 'Please specify which record to update or delete',
      suggestion: 'Use {{record_id}} to reference the triggered record, or enter a specific record ID',
      code: 'MISSING_RECORD_ID'
    }
  }

  if (lowerMessage.includes('table') && lowerMessage.includes('not found')) {
    return {
      message: 'The selected table could not be found',
      suggestion: 'The table may have been deleted. Please select a different table or recreate the table',
      code: 'TABLE_NOT_FOUND'
    }
  }

  if (lowerMessage.includes('record') && lowerMessage.includes('not found')) {
    return {
      message: 'The record could not be found',
      suggestion: 'The record may have been deleted. Check that the record ID is correct',
      code: 'RECORD_NOT_FOUND'
    }
  }

  // Field errors
  if (lowerMessage.includes('field') && (lowerMessage.includes('required') || lowerMessage.includes('missing'))) {
    return {
      message: 'A required field is missing',
      suggestion: context?.fieldName 
        ? `Please provide a value for the "${context.fieldName}" field`
        : 'Check that all required fields have values',
      code: 'MISSING_FIELD'
    }
  }

  if (lowerMessage.includes('invalid') && lowerMessage.includes('email')) {
    return {
      message: 'The email address format is invalid',
      suggestion: 'Please enter a valid email address (e.g., user@example.com)',
      code: 'INVALID_EMAIL'
    }
  }

  if (lowerMessage.includes('invalid') && lowerMessage.includes('url')) {
    return {
      message: 'The webhook URL format is invalid',
      suggestion: 'Please enter a valid URL starting with http:// or https://',
      code: 'INVALID_URL'
    }
  }

  // Webhook errors
  if (lowerMessage.includes('webhook') && lowerMessage.includes('failed')) {
    return {
      message: 'The webhook call failed',
      suggestion: 'Check that the webhook URL is correct and the receiving service is available. The service may be temporarily down.',
      code: 'WEBHOOK_FAILED'
    }
  }

  if (lowerMessage.includes('webhook') && lowerMessage.includes('timeout')) {
    return {
      message: 'The webhook request timed out',
      suggestion: 'The receiving service took too long to respond. Check that the service is running and try again.',
      code: 'WEBHOOK_TIMEOUT'
    }
  }

  // Formula errors
  if (lowerMessage.includes('formula') || lowerMessage.includes('syntax error')) {
    return {
      message: 'There\'s an error in your formula',
      suggestion: 'Check the formula syntax. Make sure all field names are correct and functions are properly formatted.',
      code: 'FORMULA_ERROR'
    }
  }

  // Variable errors
  if (lowerMessage.includes('variable') || lowerMessage.includes('{{')) {
    return {
      message: 'A variable could not be found or replaced',
      suggestion: 'Check that the variable name is correct. Use {{field_name}} to reference fields from the trigger record.',
      code: 'VARIABLE_ERROR'
    }
  }

  // Permission errors
  if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
    return {
      message: 'You don\'t have permission to perform this action',
      suggestion: 'Contact your administrator to request access to this table or action',
      code: 'PERMISSION_DENIED'
    }
  }

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return {
      message: 'A network error occurred',
      suggestion: 'Check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.',
      code: 'NETWORK_ERROR'
    }
  }

  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return {
      message: 'The operation took too long to complete',
      suggestion: 'The automation may be processing a large amount of data. Try simplifying the automation or breaking it into smaller steps.',
      code: 'TIMEOUT'
    }
  }

  // Generic database errors
  if (lowerMessage.includes('foreign key') || lowerMessage.includes('constraint')) {
    return {
      message: 'This action would violate a data constraint',
      suggestion: 'The record you\'re trying to create or update references data that doesn\'t exist. Check that all related records are valid.',
      code: 'CONSTRAINT_ERROR'
    }
  }

  if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique')) {
    return {
      message: 'A record with this value already exists',
      suggestion: 'The value you\'re trying to use must be unique. Try using a different value or updating the existing record instead.',
      code: 'DUPLICATE_ERROR'
    }
  }

  // Default: return original message but make it slightly more friendly
  return {
    message: errorMessage,
    suggestion: 'If this error persists, try checking the automation configuration or contact support',
    code: 'UNKNOWN_ERROR'
  }
}

/**
 * Format error for display in UI
 */
export function formatErrorForDisplay(error: UserFriendlyError): string {
  if (error.suggestion) {
    return `${error.message}\n\n💡 ${error.suggestion}`
  }
  return error.message
}
