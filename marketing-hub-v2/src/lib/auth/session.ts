import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_STAFF, hasSupabaseConfig, isAuthBypass } from "@/lib/auth/config";

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "staff" | "media_guest";
};

export async function getSessionUser(
  request?: NextRequest
): Promise<SessionUser | null> {
  // Local demo: bypass flag OR no Supabase yet → staff demo user + JSON store.
  if (isAuthBypass() || !hasSupabaseConfig()) {
    return DEMO_STAFF;
  }

  if (request) {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      id: user.id,
      email: user.email ?? "",
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        user.email ??
        "Staff",
      role: "staff",
    };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    full_name:
      (user.user_metadata?.full_name as string | undefined) ??
      user.email ??
      "Staff",
    role: "staff",
  };
}
