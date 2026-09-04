import { NextRequest, NextResponse } from "next/server";
import { mcpCorsPreflight, withMcpCors } from "@/lib/mcp/cors";
import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  isMcpConfigured,
  issueAccessToken,
  verifyMcpClient,
} from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function oauthError(
  request: NextRequest,
  error: string,
  description?: string,
  status = 400
): Response {
  return withMcpCors(
    NextResponse.json(
      { error, ...(description ? { error_description: description } : {}) },
      { status }
    ),
    request
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

export async function OPTIONS(request: NextRequest) {
  return mcpCorsPreflight(request);
}

export async function POST(request: NextRequest) {
  if (!isMcpConfigured()) {
    return oauthError(
      request,
      "server_error",
      "MCP OAuth is not configured",
      503
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: URLSearchParams;
  try {
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      body = new URLSearchParams();
      for (const [key, value] of Object.entries(json)) {
        if (value == null) continue;
        body.set(key, String(value));
      }
    } else {
      body = new URLSearchParams(await request.text());
    }
  } catch {
    return oauthError(request, "invalid_request", "Could not parse body");
  }

  const grantType = body.get("grant_type")?.trim();
  const { clientId, clientSecret } = readClientCredentials(request, body);

  if (grantType === "client_credentials") {
    if (!verifyMcpClient(clientId, clientSecret)) {
      return oauthError(request, "invalid_client", undefined, 401);
    }
    return withMcpCors(NextResponse.json(issueAccessToken(clientId)), request);
  }

  if (grantType === "refresh_token") {
    const refreshToken = body.get("refresh_token")?.trim() ?? "";
    const result = exchangeRefreshToken({
      refreshToken,
      clientId,
      clientSecret,
    });
    if ("error" in result) {
      return oauthError(request, result.error ?? "invalid_grant", undefined, 400);
    }
    return withMcpCors(NextResponse.json(result.token), request);
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
      return oauthError(request, result.error ?? "invalid_grant", undefined, 400);
    }
    return withMcpCors(NextResponse.json(result.token), request);
  }

  return oauthError(request, "unsupported_grant_type");
}
