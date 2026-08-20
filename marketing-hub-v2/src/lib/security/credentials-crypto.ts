import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer | null {
  const raw =
    process.env.CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

export function isEncryptedCredential(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypt a platform password for hub_store. Falls back to plaintext when no key is set. */
export function encryptCredentialSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = encryptionKey();
  if (!key) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

/** Decrypt a stored credential password. Plaintext legacy values pass through. */
export function decryptCredentialSecret(stored: string): string {
  if (!stored || !isEncryptedCredential(stored)) return stored;
  const key = encryptionKey();
  if (!key) return "";

  const body = stored.slice(PREFIX.length);
  const [ivB64, dataB64, tagB64] = body.split(".");
  if (!ivB64 || !dataB64 || !tagB64) return "";

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}
