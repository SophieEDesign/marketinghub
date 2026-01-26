/**
 * Utility functions for displaying user information
 * Converts user IDs (UUIDs) to user-friendly display names
 */

import { createClient } from "@/lib/supabase/client"

/**
 * Formats an email address into a friendly display name
 * Example: "john.doe@example.com" -> "John Doe"
 */
export function formatUserDisplayName(emailOrNull: string | null): string {
  if (!emailOrNull) return "Unknown"
  const email = String(emailOrNull)
  const local = email.split("@")[0] || email
  const parts = local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
  return parts.join(" ") || email
}

/**
 * Checks if a value looks like a UUID (user ID)
 */
export function isUserId(value: any): boolean {
  if (typeof value !== "string") return false
  // UUID v4 pattern
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Checks if a field name is a user-related system field
 */
export function isUserField(fieldName: string | null | undefined): boolean {
  if (!fieldName) return false
  const lower = fieldName.toLowerCase()
  return lower === "created_by" || lower === "updated_by" || lower === "user_id" || lower === "owner_id"
}

/**
 * Fetches user emails for given user IDs and returns a map
 * Uses the user_profile_sync_status view which is safe for authenticated users
 */
export async function fetchUserEmails(userIds: string[]): Promise<Map<string, string | null>> {
  const userMap = new Map<string, string | null>()
  
  if (userIds.length === 0) return userMap

  try {
    const supabase = createClient()
    const { data: users } = await supabase
      .from("user_profile_sync_status")
      .select("user_id, email")
      .in("user_id", userIds)

    if (users) {
      users.forEach((u: any) => {
        userMap.set(u.user_id, u.email || null)
      })
    }
  } catch (error) {
    // View may not exist yet - fail gracefully
    console.warn("Could not load user emails:", error)
  }

  return userMap
}

/**
 * Fetches a single user's email and returns formatted display name
 */
export async function getUserDisplayName(userId: string | null | undefined): Promise<string> {
  if (!userId || !isUserId(userId)) return "Unknown"
  
  const userMap = await fetchUserEmails([userId])
  const email = userMap.get(userId)
  return formatUserDisplayName(email)
}

/**
 * Batch fetches user display names for multiple user IDs
 * Returns a map of userId -> displayName
 */
export async function getUserDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const displayNames = new Map<string, string>()
  
  if (userIds.length === 0) return displayNames

  const userMap = await fetchUserEmails(userIds)
  
  userIds.forEach((userId) => {
    const email = userMap.get(userId)
    displayNames.set(userId, formatUserDisplayName(email))
  })

  return displayNames
}
