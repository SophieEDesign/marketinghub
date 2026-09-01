import {
  metadataCorsOptionsRequestHandler,
} from "mcp-handler";
import { oauthAuthorizationServerMetadata } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const corsHandler = metadataCorsOptionsRequestHandler();

export async function GET(request: Request) {
  return Response.json(oauthAuthorizationServerMetadata(request), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}

export { corsHandler as OPTIONS };
