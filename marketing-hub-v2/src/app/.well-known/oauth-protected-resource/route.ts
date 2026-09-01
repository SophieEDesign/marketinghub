import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { getMcpOAuthIssuer, getMcpResourceUrl } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = (request: Request) =>
  protectedResourceHandler({
    authServerUrls: [getMcpOAuthIssuer(request)],
    resourceUrl: getMcpResourceUrl(request),
  })(request);

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
