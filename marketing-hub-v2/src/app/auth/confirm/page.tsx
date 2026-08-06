"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { hasSupabaseConfig } from "@/lib/auth/config-client";
import { safeNextPath } from "@/lib/auth/safe-next";
import { BrandLockup } from "@/components/shell/BrandLockup";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function copyForType(type: string | null) {
  switch (type) {
    case "recovery":
      return {
        title: "Reset your password",
        body: "Outlook and other email security tools often open invite links automatically. Click below to continue — this step keeps your link valid until you do.",
        cta: "Continue to set password",
      };
    case "magiclink":
      return {
        title: "Sign in to Marketing Hub",
        body: "Click below to finish signing in. This confirms it’s you, not an automated email scan.",
        cta: "Continue to sign in",
      };
    case "email_change":
      return {
        title: "Confirm your email",
        body: "Click below to confirm this email change for your Marketing Hub account.",
        cta: "Confirm email change",
      };
    default:
      return {
        title: "Activate your account",
        body: "Outlook and other email security tools often open invite links automatically. Click below to continue — this step keeps your invite valid until you do.",
        cta: "Continue to set password",
      };
  }
}

function AuthConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"), "/set-password");
  const copy = copyForType(typeParam);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const paramsOk =
    Boolean(tokenHash) &&
    Boolean(typeParam) &&
    OTP_TYPES.includes(typeParam as EmailOtpType) &&
    hasSupabaseConfig();

  async function onContinue() {
    if (!paramsOk || !tokenHash || !typeParam) {
      setError(
        "This link is invalid or has expired. Ask an admin to resend the invite or password reset."
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: typeParam as EmailOtpType,
        token_hash: tokenHash,
      });
      if (verifyError) {
        setError(
          verifyError.message ||
            "This link is invalid or has expired. Ask an admin to resend the invite or password reset."
        );
        setLoading(false);
        return;
      }
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm link");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/login" className="mb-8 text-sm text-muted hover:text-foreground">
        ← Back to login
      </Link>
      <BrandLockup className="mb-8" size={56} />
      <h1 className="font-display text-3xl text-brand">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.body}</p>

      <div className="surface-card mt-8 space-y-4 p-6">
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        {!paramsOk && !error ? (
          <p className="text-sm text-[var(--danger)]">
            This link is invalid or has expired. Ask an admin to resend the invite
            or password reset.
          </p>
        ) : null}

        {paramsOk ? (
          <button
            type="button"
            className="btn-primary w-full"
            disabled={loading}
            onClick={() => void onContinue()}
          >
            {loading ? "Confirming…" : copy.cta}
          </button>
        ) : (
          <Link href="/login" className="btn-secondary inline-flex w-full justify-center">
            Go to login
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Email templates link here with token_hash + type.
 * Verification runs only after an explicit click so Outlook Safe Links /
 * Defender URL rewrites cannot burn the one-time token on prefetch.
 */
export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
          <p className="text-sm text-muted">Preparing your link…</p>
        </div>
      }
    >
      <AuthConfirmInner />
    </Suspense>
  );
}
