import { verifyMcpAccessToken } from "@/lib/mcp/oauth";

/** Bearer token or `x-hub-mcp-key` header. */
export function verifyMcpApiKey(request: Request): boolean {
  const headerKey = request.headers.get("x-hub-mcp-key")?.trim() ?? "";
  if (headerKey && verifyMcpAccessToken(headerKey)) return true;

  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token && verifyMcpAccessToken(token)) return true;
  }

  return false;
}

export { getMcpApiKey, isMcpConfigured } from "@/lib/mcp/oauth";
