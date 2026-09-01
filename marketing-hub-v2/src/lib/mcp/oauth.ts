import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const ACCESS_TOKEN_TTL_SEC = 60 * 60;
const AUTH_CODE_TTL_SEC = 5 * 60;

type TokenPayload = {
  type: "access" | "code";
  clientId: string;
  scope: string;
  exp: number;
  redirectUri?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
};

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function signingSecret(): string | null {
  return getMcpOAuthClientSecret() ?? getMcpApiKey();
}

function signPayload(payload: TokenPayload): string {
  const secret = signingSecret();
  if (!secret) throw new Error("MCP OAuth is not configured");

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest();
  return `${header}.${body}.${base64UrlEncode(signature)}`;
}

export function verifySignedToken(token: string): TokenPayload | null {
  const secret = signingSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest();
  const actual = base64UrlDecode(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(body).toString("utf8")
    ) as TokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getMcpApiKey(): string | null {
  const key = process.env.HUB_MCP_API_KEY?.trim();
  return key || null;
}

export function getMcpOAuthClientId(): string {
  return (
    process.env.HUB_MCP_OAUTH_CLIENT_ID?.trim() || "marketing-hub-chatgpt"
  );
}

export function getMcpOAuthClientSecret(): string | null {
  const secret = process.env.HUB_MCP_OAUTH_CLIENT_SECRET?.trim();
  if (secret) return secret;
  return getMcpApiKey();
}

export function isMcpConfigured(): boolean {
  return Boolean(signingSecret());
}

export function getMcpPublicOrigin(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost.split(",")[0].trim()}`;
    }
    return new URL(request.url).origin;
  }

  return "http://localhost:3001";
}

export function getMcpOAuthIssuer(request?: Request): string {
  return `${getMcpPublicOrigin(request)}/api/mcp/oauth`;
}

export function getMcpResourceUrl(request?: Request): string {
  return `${getMcpPublicOrigin(request)}/api/mcp`;
}

export function verifyMcpClient(
  clientId: string,
  clientSecret?: string | null
): boolean {
  if (!isMcpConfigured()) return false;
  if (!secretsMatch(clientId, getMcpOAuthClientId())) return false;
  if (clientSecret == null) return true;
  const expected = getMcpOAuthClientSecret();
  return Boolean(expected && secretsMatch(clientSecret, expected));
}

export function issueAccessToken(clientId: string, scope = "mcp:tools") {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SEC;
  const token = signPayload({
    type: "access",
    clientId,
    scope,
    exp,
  });
  return {
    access_token: token,
    token_type: "Bearer" as const,
    expires_in: ACCESS_TOKEN_TTL_SEC,
    scope,
  };
}

export function createAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}) {
  const exp = Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_SEC;
  return signPayload({
    type: "code",
    clientId: input.clientId,
    scope: "mcp:tools",
    exp,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
  });
}

function pkceS256(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

export function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  clientSecret?: string | null;
  redirectUri: string;
  codeVerifier?: string | null;
}) {
  if (!verifyMcpClient(input.clientId, input.clientSecret)) {
    return { error: "invalid_client" as const };
  }

  const payload = verifySignedToken(input.code);
  if (!payload || payload.type !== "code") {
    return { error: "invalid_grant" as const };
  }
  if (payload.clientId !== input.clientId) {
    return { error: "invalid_grant" as const };
  }
  if (payload.redirectUri !== input.redirectUri) {
    return { error: "invalid_grant" as const };
  }

  if (payload.codeChallenge) {
    const method = payload.codeChallengeMethod ?? "S256";
    if (!input.codeVerifier) return { error: "invalid_grant" as const };
    const challenge =
      method === "plain" ? input.codeVerifier : pkceS256(input.codeVerifier);
    if (challenge !== payload.codeChallenge) {
      return { error: "invalid_grant" as const };
    }
  }

  return { token: issueAccessToken(input.clientId, payload.scope) };
}

export function verifyMcpAccessToken(
  bearerToken?: string | null
): { clientId: string; scope: string } | null {
  if (!bearerToken) return null;

  const apiKey = getMcpApiKey();
  if (apiKey && secretsMatch(bearerToken, apiKey)) {
    return { clientId: getMcpOAuthClientId(), scope: "mcp:tools" };
  }

  const payload = verifySignedToken(bearerToken);
  if (!payload || payload.type !== "access") return null;
  return { clientId: payload.clientId, scope: payload.scope };
}

export function isAllowedRedirectUri(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:") return false;
    return (
      url.hostname === "chatgpt.com" ||
      url.hostname.endsWith(".chatgpt.com") ||
      url.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

export function oauthAuthorizationServerMetadata(request?: Request) {
  const issuer = getMcpOAuthIssuer(request);
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials"],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
      "none",
    ],
    code_challenge_methods_supported: ["S256", "plain"],
    scopes_supported: ["mcp:tools"],
  };
}

export function randomStateToken(): string {
  return base64UrlEncode(randomBytes(24));
}
