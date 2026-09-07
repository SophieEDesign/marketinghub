import {
  createMcpHandler,
  isLegacyRequest,
  McpServer,
  WebStandardStreamableHTTPServerTransport,
  type AuthInfo,
} from "@modelcontextprotocol/server";
import { withMcpAuth } from "mcp-handler";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";
import {
  getMcpResourceUrl,
  isMcpConfigured,
  verifyMcpAccessToken,
} from "@/lib/mcp/oauth";
import { registerHubMcpTools } from "@/lib/mcp/register-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Avoid cold-start cutoffs during tool calls (Planable / Supabase). */
export const maxDuration = 60;

const SERVER_INFO = {
  name: "peters-may-marketing-hub",
  // Bump when transport/tools change so ChatGPT/MCP clients re-fetch tools/list.
  version: "1.2.1",
};

const INSTRUCTIONS = `You are connected to the Peters & May Marketing Hub MCP.

Social / content:
- Use get_brand_context and list_themes before drafting posts.
- Create drafts with create_social_draft; refine with update_social_post.
- Publishing happens in Planable — do not set status to published.

WhatsApp enquiry tracker (Enquiries → WhatsApp tab):
- create_whatsapp_enquiry for each new WhatsApp enquiry (omit external_id to auto-allocate WA-###).
- update_whatsapp_enquiry for chase / quote / status / office updates (identify by external_id WA-###).
- list_enquiries with channel "whatsapp" to review recent tracker rows.
Fields match the Excel tracker (customer, office, vessel, status, etc.).`;

function createHubMcpServer() {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  registerHubMcpTools(server);
  return server;
}

/**
 * ChatGPT still speaks 2025-era Streamable HTTP (legacy path).
 * mcp-handler's default legacy fallback uses SSE (`enableJsonResponse: false`).
 * On Vercel, those SSE tool-result streams often never close — clients hang
 * forever after tools/list works. Force JSON request/response for serverless.
 */
async function handleLegacyMcp(
  request: Request,
  options?: { authInfo?: AuthInfo; parsedBody?: unknown }
): Promise<Response> {
  if (request.method.toUpperCase() !== "POST") {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      },
      { status: 405, headers: { Allow: "POST" } }
    );
  }

  const server = createHubMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, {
      authInfo: options?.authInfo,
      parsedBody: options?.parsedBody,
    });
  } finally {
    await Promise.allSettled([transport.close(), server.close()]);
  }
}

const modernHandler = createMcpHandler(async () => createHubMcpServer(), {
  legacy: "reject",
  // Prefer closed JSON responses over open SSE on serverless.
  responseMode: "json",
  onerror: (err) => {
    console.error("[mcp] sdk error", err);
  },
});

function notConfigured(): Response {
  return new Response(
    JSON.stringify({
      error:
        "MCP is not configured. Set HUB_MCP_API_KEY on the Hub deployment.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}

async function verifyToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const auth = verifyMcpAccessToken(bearerToken);
  if (!auth) return undefined;
  return {
    token: bearerToken!,
    scopes: auth.scope.split(/\s+/).filter(Boolean),
    clientId: auth.clientId,
  };
}

function mcpMethodFromBody(parsedBody: unknown): string | undefined {
  if (
    parsedBody &&
    typeof parsedBody === "object" &&
    "method" in parsedBody &&
    typeof (parsedBody as { method: unknown }).method === "string"
  ) {
    return (parsedBody as { method: string }).method;
  }
  return undefined;
}

async function mcpCore(request: Request): Promise<Response> {
  const started = Date.now();
  let parsedBody: unknown;
  let mcpMethod = "(none)";

  if (
    request.method === "POST" &&
    (request.headers.get("content-type") || "").includes("application/json")
  ) {
    try {
      parsedBody = await request.clone().json();
      mcpMethod = mcpMethodFromBody(parsedBody) ?? "(unparseable)";
    } catch {
      mcpMethod = "(invalid-json)";
    }
  }

  console.info("[mcp] request", {
    httpMethod: request.method,
    mcpMethod,
    accept: request.headers.get("accept"),
    protocol: request.headers.get("mcp-protocol-version"),
  });

  try {
    const authInfo = request.auth;
    const legacy = await isLegacyRequest(request, parsedBody);
    const response = legacy
      ? await handleLegacyMcp(request, { authInfo, parsedBody })
      : await modernHandler.fetch(request, { authInfo, parsedBody });

    console.info("[mcp] completed", {
      mcpMethod,
      legacy,
      status: response.status,
      contentType: response.headers.get("content-type"),
      durationMs: Date.now() - started,
    });

    return response;
  } catch (err) {
    console.error("[mcp] handler error", { mcpMethod, err });
    return new Response(
      JSON.stringify({
        error: "MCP handler failed",
        message: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleMcp(request: Request): Promise<Response> {
  if (!isMcpConfigured()) return withMcpCors(notConfigured(), request);

  // Build auth wrapper per request so resource URL always matches the live host
  // (avoids stale NEXT_PUBLIC_APP_URL mismatches that break ChatGPT discovery).
  const authHandler = withMcpAuth(mcpCore, verifyToken, {
    required: true,
    requiredScopes: ["mcp:tools"],
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
    resourceUrl: getMcpResourceUrl(request),
  });

  try {
    return withMcpCors(await authHandler(request), request);
  } catch (err) {
    console.error("[mcp] auth/handler error", err);
    return withMcpCors(
      new Response(
        JSON.stringify({
          error: "MCP handler failed",
          message: err instanceof Error ? err.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ),
      request
    );
  }
}

export async function OPTIONS(request: Request) {
  return mcpCorsPreflight(request);
}

export { handleMcp as GET, handleMcp as POST, handleMcp as DELETE };
