/**
 * Parse @mentions from comment body.
 * Extracts emails in format @user@domain.com
 */

const MENTION_REGEX = /@([\w.-]+@[\w.-]+\.\w+)/g

/**
 * Extract unique email addresses from @mention patterns in text.
 * @param body - Comment body text
 * @returns Deduplicated list of matched emails (lowercase)
 */
export function parseMentions(body: string): string[] {
  if (!body || typeof body !== "string") return []
  const matches = body.matchAll(MENTION_REGEX)
  const emails = new Set<string>()
  for (const m of matches) {
    const email = m[1]?.toLowerCase()
    if (email) emails.add(email)
  }
  return Array.from(emails)
}
