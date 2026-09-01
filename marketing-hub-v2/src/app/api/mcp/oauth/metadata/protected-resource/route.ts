import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { getMcpOAuthIssuer, getMcpResourceUrl } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const corsHandler = metadataCorsOptionsRequestHandler();

export async function GET(request: Request) {
  return protectedResourceHandler({
    authServerUrls: [getMcpOAuthIssuer(request)],
    resourceUrl: getMcpResourceUrl(request),
  })(request);
}

export { corsHandler as OPTIONS };
