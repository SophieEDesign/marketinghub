type ServiceAccountCredentials = {
  client_email?: string
  private_key?: string
}

/** Extract a useful message from googleapis / Gaxios failures. */
export function formatDriveApiError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Failed to load gallery"
  }

  const err = error as {
    message?: string
    response?: { status?: number; data?: { error?: { message?: string; errors?: Array<{ message?: string }> } } }
  }

  const apiMessage = err.response?.data?.error?.message
  const nested = err.response?.data?.error?.errors?.[0]?.message
  const status = err.response?.status

  if (apiMessage) {
    if (status === 403) {
      return `${apiMessage} Share the gallery folder with the service account email as Viewer, and confirm the Drive API is enabled.`
    }
    if (status === 404) {
      return `${apiMessage} Check the folder id and that the service account can access the folder.`
    }
    return apiMessage
  }

  if (nested) return nested

  const message = err.message ?? "Failed to load gallery"
  if (message.includes("invalid_grant") || message.includes("Invalid JWT")) {
    return "Google service account key is invalid. Re-check GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY formatting in Vercel (use \\n for line breaks, or paste the full JSON into GOOGLE_SERVICE_ACCOUNT_JSON)."
  }

  return message
}

/** Normalize PEM / JSON service-account key values from env providers. */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim()

  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim()
  }

  if (key.startsWith("{")) {
    try {
      const json = JSON.parse(key) as ServiceAccountCredentials
      if (json.private_key) {
        return json.private_key.replace(/\\n/g, "\n")
      }
    } catch {
      // fall through to PEM handling
    }
  }

  return key.replace(/\\n/g, "\n")
}

export function readServiceAccountCredentials():
  | { email: string; privateKey: string }
  | { error: string } {
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  if (jsonRaw) {
    try {
      const json = JSON.parse(jsonRaw) as ServiceAccountCredentials
      const email = json.client_email?.trim()
      const privateKey = json.private_key ? normalizePrivateKey(json.private_key) : ""
      if (email && privateKey) {
        return { email, privateKey }
      }
      return {
        error:
          "GOOGLE_SERVICE_ACCOUNT_JSON is set but missing client_email or private_key.",
      }
    } catch {
      return { error: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON." }
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()

  if (!email || !rawKey) {
    return {
      error:
        "Drive gallery not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON).",
    }
  }

  const privateKey = normalizePrivateKey(rawKey)
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    return {
      error:
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY does not look like a PEM key. Paste the full JSON into GOOGLE_SERVICE_ACCOUNT_JSON instead.",
    }
  }

  return { email, privateKey }
}
