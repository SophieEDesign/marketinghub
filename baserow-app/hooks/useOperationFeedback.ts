"use client"

import { useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { isAbortError } from "@/lib/supabase/errors"

interface OperationFeedbackOptions {
  successTitle?: string
  successDescription?: string
  errorTitle?: string
  errorDescription?: (error: unknown) => string
  showSuccess?: boolean
  showError?: boolean
}

/**
 * Hook for consistent error/success handling with toast notifications
 * Replaces console.error calls with user-visible feedback
 */
export function useOperationFeedback(options: OperationFeedbackOptions = {}) {
  const { toast } = useToast()

  const {
    successTitle = "Success",
    successDescription = "Operation completed successfully",
    errorTitle = "Error",
    errorDescription = (err: unknown) => {
      if (err instanceof Error) return err.message
      if (typeof err === "string") return err
      return "An unexpected error occurred"
    },
    showSuccess = true,
    showError = true,
  } = options

  const handleSuccess = useCallback(
    (customTitle?: string, customDescription?: string) => {
      if (!showSuccess) return
      toast({
        variant: "success",
        title: customTitle || successTitle,
        description: customDescription || successDescription,
      })
    },
    [toast, successTitle, successDescription, showSuccess]
  )

  const handleError = useCallback(
    (error: unknown, customTitle?: string, customDescription?: string) => {
      // Don't show toast for abort errors (component unmounted, navigation, etc.)
      if (isAbortError(error)) {
        return
      }

      if (!showError) {
        // Still log to console if not showing toast
        console.error("Operation error:", error)
        return
      }

      const title = customTitle || errorTitle
      const description = customDescription || errorDescription(error)

      toast({
        variant: "destructive",
        title,
        description,
      })
    },
    [toast, errorTitle, errorDescription, showError]
  )

  const handleOperation = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options?: {
        successTitle?: string
        successDescription?: string
        errorTitle?: string
        errorDescription?: string
      }
    ): Promise<T | null> => {
      try {
        const result = await operation()
        if (options?.successTitle || options?.successDescription) {
          handleSuccess(options.successTitle, options.successDescription)
        } else if (showSuccess) {
          handleSuccess()
        }
        return result
      } catch (error) {
        handleError(
          error,
          options?.errorTitle,
          options?.errorDescription
        )
        return null
      }
    },
    [handleSuccess, handleError, showSuccess]
  )

  return {
    handleSuccess,
    handleError,
    handleOperation,
  }
}
