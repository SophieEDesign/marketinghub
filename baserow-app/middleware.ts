import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Authentication Middleware
 * 
 * This middleware protects routes by checking for valid Supabase authentication sessions.
 * Unauthenticated users accessing protected routes are redirected to /login with a 'next' parameter.
 * 
 * Security: Authentication is ENABLED by default. Only bypass in development with AUTH_BYPASS=true.
 */

/**
 * Check if a pathname matches a route pattern
 * Supports exact matches and prefix matches (with trailing slash)
 */
function matchesRoute(pathname: string, route: string): boolean {
  // Exact match
  if (pathname === route) return true;
  
  // Prefix match (route starts with pattern + '/')
  if (pathname.startsWith(route + '/')) return true;
  
  return false;
}

const ACCESS_TOKEN_COOKIE_PATTERNS = [
  /^sb-access-token$/i,
  /^sb-.*-access-token$/i,
]
const REFRESH_TOKEN_COOKIE_PATTERNS = [
  /^sb-refresh-token$/i,
  /^sb-.*-refresh-token$/i,
]
const AUTH_TOKEN_COOKIE_PATTERNS = [
  /^sb-.*-auth-token$/i,
]

function stripChunkSuffix(name: string): { base: string; index: number | null } {
  const match = name.match(/^(.*)\.(\d+)$/)
  if (!match) return { base: name, index: null }
  return { base: match[1], index: Number(match[2]) }
}

function decodeBase64Url(input: string): string | null {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return atob(padded)
  } catch {
    return null
  }
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  const decoded = decodeBase64Url(parts[1])
  if (!decoded) return null
  try {
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function isAccessTokenValid(token: string, leewaySeconds: number = 30): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false
  const expiresAtMs = payload.exp * 1000
  return Date.now() + leewaySeconds * 1000 < expiresAtMs
}

function getCookieValue(
  cookies: Array<{ name: string; value: string }>,
  patterns: RegExp[]
): string | null {
  for (const cookie of cookies) {
    if (patterns.some((pattern) => pattern.test(cookie.name))) {
      return cookie.value
    }
  }
  return null
}

function getCookieValueWithChunks(
  cookies: Array<{ name: string; value: string }>,
  patterns: RegExp[]
): string | null {
  // Fast path: exact cookie present
  const direct = getCookieValue(cookies, patterns)
  if (direct) return direct

  // Chunked cookies: <name>.0, <name>.1, ...
  const chunksByBase = new Map<string, Array<{ index: number; value: string }>>()
  for (const cookie of cookies) {
    const { base, index } = stripChunkSuffix(cookie.name)
    if (index === null) continue
    if (!patterns.some((pattern) => pattern.test(base))) continue
    const arr = chunksByBase.get(base) || []
    arr.push({ index, value: cookie.value })
    chunksByBase.set(base, arr)
  }

  // If multiple bases match, use the first deterministically.
  const first = [...chunksByBase.entries()].sort(([a], [b]) => a.localeCompare(b))[0]
  if (!first) return null

  const [, chunks] = first
  chunks.sort((a, b) => a.index - b.index)
  return chunks.map((c) => c.value).join('')
}

function getTokensFromAuthCookie(
  value: string | null
): { accessToken: string | null; refreshToken: string | null } {
  if (!value) return { accessToken: null, refreshToken: null }
  try {
    let decoded = value
    try {
      decoded = decodeURIComponent(value)
    } catch {
      decoded = value
    }
    const parsed = JSON.parse(decoded)
    return {
      accessToken: parsed?.access_token ? String(parsed.access_token) : null,
      refreshToken: parsed?.refresh_token ? String(parsed.refresh_token) : null,
    }
  } catch {
    // Some environments store the auth cookie as base64/base64url JSON.
    const base64Decoded = decodeBase64Url(value)
    if (base64Decoded) {
      try {
        const parsed = JSON.parse(base64Decoded)
        return {
          accessToken: parsed?.access_token ? String(parsed.access_token) : null,
          refreshToken: parsed?.refresh_token ? String(parsed.refresh_token) : null,
        }
      } catch {
        // fallthrough
      }
    }
    return { accessToken: null, refreshToken: null }
  }
}

function getAuthTokens(req: NextRequest): { accessToken: string | null; refreshToken: string | null } {
  const cookies = req.cookies.getAll()
  const authCookieValue = getCookieValueWithChunks(cookies, AUTH_TOKEN_COOKIE_PATTERNS)
  const authCookieTokens = getTokensFromAuthCookie(authCookieValue)

  const accessToken =
    getCookieValueWithChunks(cookies, ACCESS_TOKEN_COOKIE_PATTERNS) || authCookieTokens.accessToken
  const refreshToken =
    getCookieValueWithChunks(cookies, REFRESH_TOKEN_COOKIE_PATTERNS) || authCookieTokens.refreshToken

  return { accessToken, refreshToken }
}

function isRateLimitError(error: unknown): boolean {
  const err = error as { status?: number; code?: string; message?: string } | null
  if (!err) return false
  return (
    err.status === 429 ||
    err.code === 'over_request_rate_limit' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('rate limit'))
  )
}

/**
 * Check if a route is public (doesn't require authentication)
 */
function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    '/',                    // Root - redirects to login if not authenticated
    '/login',               // Login page
    '/auth',                // All auth routes (callback, setup-password, etc.)
    '/public',              // Public routes
  ];

  // Check if pathname matches any public route
  return publicRoutes.some(route => matchesRoute(pathname, route));
}

/**
 * Check if a route is protected (requires authentication)
 */
function isProtectedRoute(pathname: string): boolean {
  const protectedRoutes = [
    '/pages',               // Interface pages
    '/tables',              // Data tables
    '/settings',            // Settings
    '/automations',         // Automations
    '/dashboard',           // Dashboards
    '/interface',           // Interface builder
    '/import',              // Import functionality
  ];

  // Check if pathname matches any protected route
  return protectedRoutes.some(route => matchesRoute(pathname, route));
}

/**
 * Check if an API route is public
 */
function isPublicApiRoute(pathname: string): boolean {
  const publicApiRoutes = [
    '/api/workspace-settings',  // Allow unauthenticated access for branding on login page
    '/api/auth',                 // Auth-related APIs (if any)
  ];

  return publicApiRoutes.some(route => matchesRoute(pathname, route));
}

/**
 * Check if an API route is protected
 * 
 * Security: All API routes are protected by default unless explicitly public.
 * This ensures new API routes are automatically protected.
 */
function isProtectedApiRoute(pathname: string): boolean {
  // Only check API routes
  if (!pathname.startsWith('/api/')) return false;
  
  // If it's a public API route, it's not protected
  if (isPublicApiRoute(pathname)) return false;
  
  // All other API routes are protected by default
  // This includes:
  // - /api/users/* (user management)
  // - /api/admin/* (admin operations)
  // - /api/private/* (private APIs)
  // - /api/pages/* (page management)
  // - /api/tables/* (table operations)
  // - /api/interface/* (interface operations)
  // - /api/automations/* (automation operations)
  // - /api/dashboard/* (dashboard operations)
  // - /api/records/* (record operations)
  // - /api/profiles/* (profile operations)
  // - /api/favorites/* (favorites)
  // - /api/recents/* (recent items)
  // - /api/search/* (search)
  // - /api/versioning/* (versioning)
  // - /api/hooks/* (webhooks)
  // - And any other /api/* routes
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/static/')
  ) {
    return NextResponse.next();
  }

  // Development bypass (ONLY in development, NEVER in production)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const authBypass = process.env.AUTH_BYPASS === 'true';
  
  if (isDevelopment && authBypass) {
    // Only allow bypass in development with explicit env var
    console.warn('[Middleware] AUTH_BYPASS is enabled - authentication is disabled for development');
    return NextResponse.next();
  }

  // Check if route is public
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check if API route is public
  if (pathname.startsWith('/api/') && isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Check if route needs protection (page routes or protected API routes)
  const needsProtection = isProtectedRoute(pathname) || isProtectedApiRoute(pathname);
  
  if (!needsProtection) {
    // Unknown route - allow through (could be a 404, let Next.js handle it)
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  // This uses the same cookie-based session management as the app
  const res = NextResponse.next();

  const isApiRoute = pathname.startsWith('/api/')
  const { accessToken, refreshToken } = getAuthTokens(req)

  // If we have a valid access token, skip the auth API call to avoid rate limits.
  if (accessToken && isAccessTokenValid(accessToken)) {
    return res
  }

  // If we have no auth cookies at all, return early without hitting Supabase.
  if (!accessToken && !refreshToken) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    if (pathname !== '/login') {
      redirectUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set(name, value, { ...(options || {}), path: options?.path ?? '/' });
        },
        remove(name: string, options: any) {
          res.cookies.set(name, '', { ...(options || {}), path: options?.path ?? '/', maxAge: -1 });
        },
      },
    }
  );

  // Check for active session
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  // If there's an error or no session, redirect to login
  if (error || !session) {
    if (error && isRateLimitError(error)) {
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'Auth rate limit reached. Please retry shortly.' },
          { status: 503, headers: { 'Retry-After': '10' } }
        )
      }

      return NextResponse.json(
        { error: 'Authentication is temporarily unavailable. Please retry.' },
        { status: 503, headers: { 'Retry-After': '10' } }
      )
    }

    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    
    // Preserve the original URL as 'next' parameter for redirect after login
    if (pathname !== '/login') {
      redirectUrl.searchParams.set('next', pathname);
    }
    
    return NextResponse.redirect(redirectUrl);
  }

  // User is authenticated, allow access
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};
