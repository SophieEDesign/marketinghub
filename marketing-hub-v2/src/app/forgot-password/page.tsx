"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { hasSupabaseConfig } from "@/lib/auth/config-client";
import { BrandLockup } from "@/components/shell/BrandLockup";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabaseReady = hasSupabaseConfig();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabaseReady) {
      setError("Supabase is not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/set-password")}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      );
      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }
      setSent(true);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/login" className="mb-8 text-sm text-muted hover:text-foreground">
        ← Back to login
      </Link>
      <BrandLockup className="mb-8" size={56} />
      <h1 className="font-display text-3xl text-brand">Reset password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter your email and we’ll send a link to choose a new password.
      </p>

      <form onSubmit={onSubmit} className="surface-card mt-8 space-y-4 p-6">
        {sent ? (
          <p className="text-sm text-brand">
            If an account exists for that email, a reset link is on its way.
            Check your inbox, then return here to sign in.
          </p>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="field"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
