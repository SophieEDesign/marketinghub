import { NextRequest, NextResponse } from "next/server";
import {
  createAuthorizationCode,
  getMcpOAuthClientId,
  isAllowedRedirectUri,
  isMcpConfigured,
  verifyMcpClient,
} from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorPage(message: string, status = 400) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;padding:2rem"><h1>Marketing Hub</h1><p>${message}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  if (!isMcpConfigured()) {
    return errorPage("MCP OAuth is not configured.", 503);
  }

  const params = request.nextUrl.searchParams;
  const responseType = params.get("response_type")?.trim();
  const clientId = params.get("client_id")?.trim() ?? "";
  const redirectUri = params.get("redirect_uri")?.trim() ?? "";
  const state = params.get("state")?.trim() ?? "";
  const codeChallenge = params.get("code_challenge")?.trim() ?? undefined;
  const codeChallengeMethod = params.get("code_challenge_method")?.trim() ?? undefined;

  if (responseType !== "code") {
    return errorPage("Unsupported response_type.");
  }
  if (!verifyMcpClient(clientId)) {
    return errorPage("Unknown OAuth client.");
  }
  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return errorPage("Invalid redirect URI.");
  }

  const approve = params.get("approve") === "1";
  if (!approve) {
    const next = new URL(request.url);
    next.searchParams.set("approve", "1");
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Connect ChatGPT to Marketing Hub</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #0f172a; }
      h1 { font-size: 1.35rem; }
      p { line-height: 1.5; color: #475569; }
      button { background: #0f4c5c; color: white; border: 0; border-radius: 0.5rem; padding: 0.75rem 1rem; font-size: 1rem; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>Connect ChatGPT to Marketing Hub</h1>
    <p>Allow ChatGPT to read themes, events, and social posts and save draft copy back to the Hub.</p>
    <form method="get" action="${next.pathname}">
      ${Array.from(next.searchParams.entries())
        .map(
          ([key, value]) =>
            `<input type="hidden" name="${key}" value="${value.replace(/"/g, "&quot;")}" />`
        )
        .join("")}
      <button type="submit">Allow access</button>
    </form>
  </body>
</html>`;
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const code = createAuthorizationCode({
    clientId: clientId || getMcpOAuthClientId(),
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return NextResponse.redirect(target);
}
