import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { isMcpConfigured, verifyMcpAccessToken } from "@/lib/mcp/oauth";
import { registerHubMcpTools } from "@/lib/mcp/register-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mcpHandler = createMcpHandler(
  (server) => {
    registerHubMcpTools(server);
  },
  {
    serverInfo: {
      name: "peters-may-marketing-hub",
      version: "1.0.0",
    },
    instructions: `You are connected to the Peters & May Marketing Hub.
Use get_brand_context and list_themes before drafting posts.
Create drafts with create_social_draft; refine with update_social_post.
Publishing happens in Planable — do not set status to published.`,
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

const authHandler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  requiredScopes: ["mcp:tools"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
  resourceUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/mcp`
    : undefined,
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

async function handleMcp(request: Request): Promise<Response> {
  if (!isMcpConfigured()) return notConfigured();
  return authHandler(request);
}

export { handleMcp as GET, handleMcp as POST, handleMcp as DELETE };
