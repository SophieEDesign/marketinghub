import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
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

const mcpHandler = createMcpHandler(
  (server) => {
    registerHubMcpTools(server);
  },
  {
    serverInfo: {
      name: "peters-may-marketing-hub",
      version: "1.1.0",
    },
    instructions: `You are connected to the Peters & May Marketing Hub MCP.

Social / content:
- Use get_brand_context and list_themes before drafting posts.
- Create drafts with create_social_draft; refine with update_social_post.
- Publishing happens in Planable — do not set status to published.

WhatsApp enquiry tracker (Enquiries → WhatsApp tab):
- create_whatsapp_enquiry for each new WhatsApp enquiry (omit external_id to auto-allocate WA-###).
- update_whatsapp_enquiry for chase / quote / status / office updates (identify by external_id WA-###).
- list_enquiries with channel "whatsapp" to review recent tracker rows.
Fields match the Excel tracker (customer, office, vessel, status, etc.).`,
  }
);

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

function notConfigured(): Response {
  return new Response(
    JSON.stringify({
      error:
        "MCP is not configured. Set HUB_MCP_API_KEY on the Hub deployment.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );
}

async function handleMcp(request: Request): Promise<Response> {
  if (!isMcpConfigured()) return notConfigured();

  // Build auth wrapper per request so resource URL always matches the live host
  // (avoids stale NEXT_PUBLIC_APP_URL mismatches that break ChatGPT discovery).
  const authHandler = withMcpAuth(mcpHandler, verifyToken, {
    required: true,
    requiredScopes: ["mcp:tools"],
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
    resourceUrl: getMcpResourceUrl(request),
  });

  try {
    return await authHandler(request);
  } catch (err) {
    console.error("[mcp] handler error", err);
    return new Response(
      JSON.stringify({
        error: "MCP handler failed",
        message: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export { handleMcp as GET, handleMcp as POST, handleMcp as DELETE };
