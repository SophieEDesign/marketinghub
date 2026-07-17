import { describe, it, expect } from "vitest"
import { formatDriveApiError, normalizePrivateKey } from "@/lib/drive/auth"

describe("drive auth helpers", () => {
  it("normalizes escaped newlines in PEM keys", () => {
    const raw = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"
    expect(normalizePrivateKey(raw)).toBe("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n")
  })

  it("extracts private_key from JSON blob", () => {
    const raw = JSON.stringify({
      client_email: "svc@test.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
    })
    expect(normalizePrivateKey(raw)).toContain("BEGIN PRIVATE KEY")
  })

  it("formats Google API permission errors", () => {
    const message = formatDriveApiError({
      response: {
        status: 403,
        data: { error: { message: "The user does not have sufficient permissions for this file." } },
      },
    })
    expect(message).toContain("sufficient permissions")
    expect(message).toContain("service account")
  })
})
