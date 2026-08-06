"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { hasSupabaseConfig } from "@/lib/auth/config-client";
import { safeNextPath } from "@/lib/auth/safe-next";

/**
 * Handles Auth redirects that still use the legacy ConfirmationURL flow.
 * - PKCE: ?code=… → exchangeCodeForSession
 * - Implicit: #access_token=… → browser client picks up the hash
 *
 * Preferred path for new emails: /auth/confirm?token_hash=… (server cookies).
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Confirming your link…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const next = safeNextPath(searchParams.get("next"), "/set-password");
      const errorDescription = searchParams.get("error_description");
      if (errorDescription) {
        router.replace(`/login?error=${encodeURIComponent(errorDescription)}`);
        return;
      }

      if (!hasSupabaseConfig()) {
        setMessage("Supabase is not configured.");
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          router.replace(
            `/set-password?error=${encodeURIComponent(error.message)}`
          );
          return;
        }
        router.replace(next);
        return;
      }

      // Implicit flow: tokens arrive in the URL hash (not visible to server routes).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.user) {
        router.replace(next);
        return;
      }

      // Give the client a brief moment to parse the hash if present.
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled) return;

      const {
        data: { session: retry },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (retry?.user) {
        router.replace(next);
        return;
      }

      router.replace(
        `/set-password?error=${encodeURIComponent(
          "This link is invalid or has expired. Ask an admin to resend the invite or password reset."
        )}`
      );
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
          <p className="text-sm text-muted">Confirming your link…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
