/**
 * Central feature flags for the app.
 *
 * IMPORTANT:
 * - Default to OFF unless explicitly enabled via env.
 * - This keeps partially-implemented features from reappearing in the UI or triggering DB queries.
 */
export const VIEWS_ENABLED: boolean = process.env.NEXT_PUBLIC_ENABLE_VIEWS === "true"

/** When true, Airtable-style dev mode UI is available at /dev/airtable */
export const isAirtableDevMode = true

