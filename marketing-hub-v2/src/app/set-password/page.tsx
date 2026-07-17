"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { hasSupabaseConfig } from "@/lib/auth/config-client";
import { BrandLockup } from "@/components/shell/BrandLockup";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const supabaseReady = hasSupabaseConfig();

  useEffect(() => {
    if (!supabaseReady) {
      setError("Supabase is not configured.");
      return;
    }

    let cancelled = false;

    async function checkSession() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        setError(
          "This link is invalid or has expired. Ask an admin to resend the invite or password reset."
        );
        setReady(false);
        return;
      }
      setEmail(session.user.email ?? null);
      setReady(true);
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [supabaseReady]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/login" className="mb-8 text-sm text-muted hover:text-foreground">
        ← Back to login
      </Link>
      <BrandLockup className="mb-8" size={56} />
      <h1 className="font-display text-3xl text-brand">Set your password</h1>
      <p className="mt-2 text-sm text-muted">
        {email
          ? `Choose a password for ${email}, then sign in.`
          : "Choose a password for your Marketing Hub account."}
      </p>

      <form onSubmit={onSubmit} className="surface-card mt-8 space-y-4 p-6">
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        {ready ? (
          <>
            <div>
              <label className="label" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                className="field"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="label" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                className="field"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Saving…" : "Save password"}
            </button>
          </>
        ) : !error ? (
          <p className="text-sm text-muted">Checking your invite link…</p>
        ) : null}
      </form>
    </div>
  );
}
