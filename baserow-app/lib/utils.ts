import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * UK Date Formatting Utilities
 * 
 * Storage format: ISO (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
 * Display format: DD/MM/YYYY (UK standard)
 * 
 * Never rely on browser locale auto-formatting.
 * Always format dates explicitly at render time.
 */

/**
 * Formats a date string (ISO format) to UK display format (DD/MM/YYYY)
 * @param dateValue - ISO date string (YYYY-MM-DD) or ISO timestamp
 * @param placeholder - Value to return if date is invalid/null
 * @returns Formatted date string (DD/MM/YYYY) or placeholder
 */
export function formatDateUK(dateValue: string | null | undefined, placeholder: string = "—"): string {
  if (!dateValue) return placeholder
  
  try {
    const date = parseISO(dateValue)
    if (!isValid(date)) return placeholder
    return format(date, "dd/MM/yyyy")
  } catch {
    return placeholder
  }
}

/**
 * Formats a Date object to UK display format (DD/MM/YYYY)
 * @param date - Date object
 * @param placeholder - Value to return if date is invalid/null
 * @returns Formatted date string (DD/MM/YYYY) or placeholder
 */
export function formatDateObjectUK(date: Date | null | undefined, placeholder: string = "—"): string {
  if (!date) return placeholder
  
  try {
    if (!isValid(date)) return placeholder
    return format(date, "dd/MM/yyyy")
  } catch {
    return placeholder
  }
}

/**
 * Formats a date string (ISO format) to UK date + time format (DD/MM/YYYY HH:mm)
 * @param dateValue - ISO timestamp string
 * @param placeholder - Value to return if date is invalid/null
 * @returns Formatted date + time string (DD/MM/YYYY HH:mm) or placeholder
 */
export function formatDateTimeUK(dateValue: string | null | undefined, placeholder: string = "—"): string {
  if (!dateValue) return placeholder
  
  try {
    const date = parseISO(dateValue)
    if (!isValid(date)) return placeholder
    return format(date, "dd/MM/yyyy HH:mm")
  } catch {
    return placeholder
  }
}

/**
 * Formats a Date object to UK date + time format (DD/MM/YYYY HH:mm)
 * @param date - Date object
 * @param placeholder - Value to return if date is invalid/null
 * @returns Formatted date + time string (DD/MM/YYYY HH:mm) or placeholder
 */
export function formatDateTimeObjectUK(date: Date | null | undefined, placeholder: string = "—"): string {
  if (!date) return placeholder
  
  try {
    if (!isValid(date)) return placeholder
    return format(date, "dd/MM/yyyy HH:mm")
  } catch {
    return placeholder
  }
}

/**
 * Converts a UK format date string (DD/MM/YYYY) to ISO format (YYYY-MM-DD)
 * Used for parsing user input in UK format
 * @param ukDateString - Date string in DD/MM/YYYY format
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 */
export function parseUKDateToISO(ukDateString: string): string | null {
  if (!ukDateString || !ukDateString.trim()) return null
  
  try {
    // Parse DD/MM/YYYY format
    const parts = ukDateString.trim().split("/")
    if (parts.length !== 3) return null
    
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null
    if (day < 1 || day > 31 || month < 1 || month > 12) return null
    
    // Create date and validate
    const date = new Date(year, month - 1, day)
    if (!isValid(date)) return null
    
    // Return ISO format (YYYY-MM-DD)
    return format(date, "yyyy-MM-dd")
  } catch {
    return null
  }
}

/**
 * Converts a Date object or ISO string to ISO date format (YYYY-MM-DD) for storage
 * This ensures dates are stored in ISO format regardless of input format
 * @param dateValue - Date object, ISO string, or UK format string
 * @returns ISO date string (YYYY-MM-DD) or null
 */
export function toISODateString(dateValue: Date | string | null | undefined): string | null {
  if (!dateValue) return null
  
  try {
    let date: Date
    
    if (dateValue instanceof Date) {
      date = dateValue
    } else if (typeof dateValue === "string") {
      // Try parsing as ISO first
      const isoDate = parseISO(dateValue)
      if (isValid(isoDate)) {
        date = isoDate
      } else {
        // Try parsing as UK format
        const isoFromUK = parseUKDateToISO(dateValue)
        if (isoFromUK) {
          date = parseISO(isoFromUK)
        } else {
          return null
        }
      }
    } else {
      return null
    }
    
    if (!isValid(date)) return null
    return format(date, "yyyy-MM-dd")
  } catch {
    return null
  }
}
