import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { withMcpCors } from "@/lib/mcp/cors";
import { oauthAuthorizationServerMetadata } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const corsHandler = metadataCorsOptionsRequestHandler();

export async function GET(request: Request) {
  return withMcpCors(
    Response.json(oauthAuthorizationServerMetadata(request), {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Content-Type": "application/json",
      },
    }),
    request
  );
}

export { corsHandler as OPTIONS };
