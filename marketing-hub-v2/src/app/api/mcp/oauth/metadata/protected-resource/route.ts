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
  const response = await protectedResourceHandler({
    authServerUrls: [getMcpOAuthIssuer(request)],
    resourceUrl: getMcpResourceUrl(request),
  })(request);
  return withMcpCors(response, request);
}

export { corsHandler as OPTIONS };
