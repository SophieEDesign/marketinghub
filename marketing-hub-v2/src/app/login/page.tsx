"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import {
  allowDemoAuthClient,
  hasSupabaseConfig,
} from "@/lib/auth/config-client";
import { safeNextPath } from "@/lib/auth/safe-next";
import { BrandLockup } from "@/components/shell/BrandLockup";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const intent = params.get("intent"); // "media" = download access only
  const isMediaIntent = intent === "media";
  const next = safeNextPath(
    params.get("next"),
    isMediaIntent ? "/media" : "/app"
  );
  const errorParam = params.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    errorParam === "supabase_not_configured"
      ? "Supabase is not configured. Use demo mode or set env vars."
      : errorParam === "auth_misconfigured"
        ? "Production auth is misconfigured. Turn off AUTH_BYPASS and set Supabase env vars."
        : null
  );
  const [loading, setLoading] = useState(false);
  const supabaseReady = hasSupabaseConfig();
  const demo = allowDemoAuthClient();

  async function grantDemoAccess(kind: "media" | "staff") {
    const res = await fetch("/api/auth/media-guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, next }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Could not grant access");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (demo) {
        await grantDemoAccess(isMediaIntent ? "media" : "staff");
        router.push(next);
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      // Stamp media cookie after real sign-in (requires session — endpoint checks auth)
      await grantDemoAccess("media");
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href={isMediaIntent ? "/media" : "/"} className="mb-8 text-sm text-muted hover:text-foreground">
        ← Back
      </Link>
      <BrandLockup className="mb-8" size={56} />
      <h1 className="font-display text-3xl text-brand">
        {isMediaIntent ? "Sign in to download" : "Staff login"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {isMediaIntent
          ? "You can browse logos and presentations without an account. Sign in to download."
          : "Internal access to events, content, sponsorships, and more."}
      </p>

      <form onSubmit={onSubmit} className="surface-card mt-8 space-y-4 p-6">
        {demo ? (
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-brand">
            Demo mode is on. Continue without a password
            {isMediaIntent ? " to unlock downloads." : " to enter the hub."}
          </p>
        ) : null}

        {!demo && supabaseReady ? (
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
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        ) : null}

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading
            ? "Signing in…"
            : demo
              ? isMediaIntent
                ? "Unlock downloads (demo)"
                : "Enter hub (demo)"
              : isMediaIntent
                ? "Sign in to download"
                : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isMediaIntent ? (
          <>
            Just browsing?{" "}
            <Link href="/media" className="text-brand underline-offset-2 hover:underline">
              Back to gallery
            </Link>
          </>
        ) : (
          <>
            Looking for logos?{" "}
            <Link href="/media" className="text-brand underline-offset-2 hover:underline">
              Open media gallery
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
