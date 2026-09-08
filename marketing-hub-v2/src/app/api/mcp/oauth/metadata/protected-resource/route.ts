import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { withMcpCors } from "@/lib/mcp/cors";
import { getMcpOAuthIssuer, getMcpResourceUrl } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const corsHandler = metadataCorsOptionsRequestHandler();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resourcePath =
    url.searchParams.get("resource")?.trim() || "/api/mcp";
  const response = await protectedResourceHandler({
    authServerUrls: [getMcpOAuthIssuer(request)],
    resourceUrl: getMcpResourceUrl(request, resourcePath),
  })(request);
  return withMcpCors(response, request);
}

export { corsHandler as OPTIONS };
