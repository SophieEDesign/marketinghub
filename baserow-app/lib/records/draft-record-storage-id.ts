/** Stable storage folder id for attachment uploads while a record is still being created. */
export function createDraftRecordStorageId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `draft-${crypto.randomUUID()}`
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
