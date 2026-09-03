"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOutOfHub } from "@/lib/auth/sign-out";

export function MediaSignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOutOfHub();
      // Hard navigation clears MediaGallery client state (download URLs / canDownload)
      // that soft refresh would otherwise leave cached after logout.
      window.location.assign("/media");
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onSignOut()}
      disabled={busy}
      className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-60"
    >
      <LogOut className="h-3.5 w-3.5" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
