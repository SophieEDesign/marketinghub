import { timingSafeEqual } from "crypto";

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getMcpApiKey(): string | null {
  const key = process.env.HUB_MCP_API_KEY?.trim();
  return key || null;
}

export function isMcpConfigured(): boolean {
  return Boolean(getMcpApiKey());
}

/** Bearer token or `x-hub-mcp-key` header. */
export function verifyMcpApiKey(request: Request): boolean {
  const expected = getMcpApiKey();
  if (!expected) return false;

  const headerKey = request.headers.get("x-hub-mcp-key")?.trim() ?? "";
  if (headerKey && secretsMatch(headerKey, expected)) return true;

  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token && secretsMatch(token, expected)) return true;
  }

  return false;
}
