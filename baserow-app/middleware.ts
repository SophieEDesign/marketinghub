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

/** Max request body size for API routes (1MB) - returns 413 when exceeded */
const API_BODY_SIZE_LIMIT_BYTES = 1024 * 1024;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Request size limit for API routes (POST/PUT/PATCH with body)
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!Number.isNaN(size) && size > API_BODY_SIZE_LIMIT_BYTES) {
        return new NextResponse(
          JSON.stringify({ error: 'Payload too large', message: `Request body exceeds ${API_BODY_SIZE_LIMIT_BYTES / 1024 / 1024}MB limit` }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // Skip static assets and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/static/')
  ) {
    return NextResponse.next();
  }

  // Redirect /data/* routes to /tables/* for backward compatibility
  // This handles external bookmarks and shared links
  if (pathname.startsWith('/data/')) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = pathname.replace('/data/', '/tables/');
    // Preserve query parameters
    return NextResponse.redirect(redirectUrl);
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
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: any) {
          res.cookies.set(name, '', { ...options, maxAge: -1 });
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
