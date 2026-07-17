"use client";

import { useState } from "react";
import { Database, RefreshCw } from "lucide-react";

export function ImportFromSupabaseButton({
  label = "Import from Supabase",
}: {
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runImport() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/supabase/import", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        setLoading(false);
        return;
      }
      setMessage(
        `Imported ${data.events ?? 0} events, ${data.content ?? 0} posts, ${data.sponsorships ?? 0} sponsorships, ${data.memberships ?? 0} memberships, ${data.contacts ?? 0} contacts, ${data.awards ?? 0} awards, ${data.themes ?? 0} themes, ${data.resources ?? 0} resources, ${data.tasks ?? 0} tasks.`
      );
      // Soft reload so server-rendered lists refresh
      window.setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-secondary"
        disabled={loading}
        onClick={() => void runImport()}
      >
        {loading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        {loading ? "Importing…" : label}
      </button>
      {message ? <p className="text-xs text-[var(--success)]">{message}</p> : null}
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
