/** Shared CORS helpers for ChatGPT / Claude MCP OAuth discovery + token exchange. */

const ALLOW_HEADERS =
  "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id";
const ALLOW_METHODS = "GET, POST, OPTIONS, DELETE";

export function mcpCorsHeaders(request?: Request): HeadersInit {
  const origin = request?.headers.get("origin")?.trim() || "*";
  const allowOrigin =
    origin === "null"
      ? "*"
      : /^(https:\/\/([a-z0-9-]+\.)*(chatgpt\.com|openai\.com|claude\.ai)|http:\/\/localhost(:\d+)?)$/i.test(
            origin
          )
        ? origin
        : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function mcpCorsPreflight(request?: Request): Response {
  return new Response(null, {
    status: 204,
    headers: mcpCorsHeaders(request),
  });
}

export function withMcpCors(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);
  const cors = mcpCorsHeaders(request);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
