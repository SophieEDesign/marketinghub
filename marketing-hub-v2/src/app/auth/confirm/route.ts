import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { hasSupabaseConfig } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/safe-next";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * SSR-safe email link handler. Email templates should link here with
 * token_hash + type so the session is stored in cookies (not the URL hash).
 *
 * Example: /auth/confirm?token_hash=…&type=invite&next=/set-password
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"), "/set-password");

  const fail = (message: string) => {
    const url = new URL("/set-password", origin);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  };

  if (!token_hash || !typeParam || !hasSupabaseConfig()) {
    return fail("This link is invalid or has expired.");
  }

  if (!OTP_TYPES.includes(typeParam as EmailOtpType)) {
    return fail("This link is invalid or has expired.");
  }

  const type = typeParam as EmailOtpType;
  const response = NextResponse.redirect(new URL(next, origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    return fail(error.message || "This link is invalid or has expired.");
  }

  return response;
}
