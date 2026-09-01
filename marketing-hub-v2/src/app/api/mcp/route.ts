import { createMcpHandler } from "mcp-handler";
import { isMcpConfigured, verifyMcpApiKey } from "@/lib/mcp/auth";
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

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="Marketing Hub MCP"',
    },
  });
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
  if (!verifyMcpApiKey(request)) return unauthorized();
  return mcpHandler(request);
}

export { handleMcp as GET, handleMcp as POST, handleMcp as DELETE };
