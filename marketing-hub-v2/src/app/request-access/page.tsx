"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandLockup } from "@/components/shell/BrandLockup";

export default function RequestAccessPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          organisation,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not submit request");
        setLoading(false);
        return;
      }
      setSuccess(
        data.message ??
          (data.outcome === "auto_member"
            ? "Invite sent — check your email."
            : "Request received — we’ll review it shortly.")
      );
      setFullName("");
      setEmail("");
      setOrganisation("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/login" className="mb-8 text-sm text-muted hover:text-foreground">
        ← Back to login
      </Link>
      <BrandLockup className="mb-8" size={56} />
      <h1 className="font-display text-3xl text-brand">Request access</h1>
      <p className="mt-2 text-sm text-muted">
        Peters &amp; May emails get staff (Member) access automatically. Other
        emails request external media access for admin review. Non–P&amp;M staff
        who need the hub should ask an admin to invite them as Member.
      </p>

      {success ? (
        <div className="surface-card mt-8 space-y-4 p-6">
          <p className="text-sm text-brand">{success}</p>
          <Link href="/login" className="btn-primary inline-flex">
            Go to login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="surface-card mt-8 space-y-4 p-6">
          <div>
            <label className="label" htmlFor="full_name">
              Full name
            </label>
            <input
              id="full_name"
              className="field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="organisation">
              Organisation <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="organisation"
              className="field"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div>
            <label className="label" htmlFor="reason">
              Why do you need access?{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="reason"
              className="field min-h-[88px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Submitting…" : "Submit request"}
          </button>
        </form>
      )}
    </div>
  );
}
