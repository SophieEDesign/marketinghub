import { NextRequest, NextResponse } from "next/server";
import {
  exchangeAuthorizationCode,
  isMcpConfigured,
  issueAccessToken,
  verifyMcpClient,
} from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function oauthError(
  error: string,
  description?: string,
  status = 400
): NextResponse {
  return NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status }
  );
}

function readClientCredentials(request: NextRequest, body: URLSearchParams) {
  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      if (sep !== -1) {
        return {
          clientId: decoded.slice(0, sep),
          clientSecret: decoded.slice(sep + 1),
        };
      }
    } catch {
      // fall through
    }
  }

  return {
    clientId: body.get("client_id")?.trim() ?? "",
    clientSecret: body.get("client_secret")?.trim() ?? "",
  };
}

export async function POST(request: NextRequest) {
  if (!isMcpConfigured()) {
    return oauthError("server_error", "MCP OAuth is not configured", 503);
  }

  const body = new URLSearchParams(await request.text());

  const grantType = body.get("grant_type")?.trim();
  const { clientId, clientSecret } = readClientCredentials(request, body);

  if (grantType === "client_credentials") {
    if (!verifyMcpClient(clientId, clientSecret)) {
      return oauthError("invalid_client", undefined, 401);
    }
    return NextResponse.json(issueAccessToken(clientId));
  }

  if (grantType === "authorization_code") {
    const code = body.get("code")?.trim() ?? "";
    const redirectUri = body.get("redirect_uri")?.trim() ?? "";
    const codeVerifier = body.get("code_verifier")?.trim() ?? null;

    const result = exchangeAuthorizationCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
      codeVerifier,
    });

    if ("error" in result) {
      return oauthError(result.error, undefined, 400);
    }
    return NextResponse.json(result.token);
  }

  return oauthError("unsupported_grant_type");
}
