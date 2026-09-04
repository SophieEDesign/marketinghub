"use client";

import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { BRAND_AI_SUMMARY } from "@/lib/brand/ai-summary";
import {
  BRAND_ISSUED,
  BRAND_PROMISE,
  BRAND_VERSION,
  LOCK_UPS,
  PALETTE_SWATCHES,
  PRINCIPLES,
  TYPOGRAPHY,
} from "@/lib/brand/tokens";

export function BrandGuidelinesPanel({
  logoUrl,
  guideUrl,
  showDownloads = true,
}: {
  logoUrl: string;
  guideUrl: string;
  showDownloads?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAiSummary() {
    try {
      await navigator.clipboard.writeText(BRAND_AI_SUMMARY);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; user can still select the text block.
    }
  }

  return (
    <div className="space-y-5">
      <section className="surface-card p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Brand Guidelines v{BRAND_VERSION} · {BRAND_ISSUED}
        </p>
        <p className="mt-2 font-display text-2xl tracking-tight text-brand md:text-3xl">
          {BRAND_PROMISE}
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted md:text-base">
          Positioning line for internal alignment and considered literature use
          — not a strapline to lock up with the logo. Principles:{" "}
          {PRINCIPLES.join(", ").toLowerCase()}.
        </p>
      </section>

      <section className="surface-card p-6 md:p-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Using the logo
        </h2>
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="flex items-center justify-center rounded-2xl border border-border bg-sand/50 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Peters & May logo"
              className="max-h-28 w-auto object-contain"
            />
          </div>
          <div>
            <p className="text-sm leading-relaxed text-muted md:text-base">
              Clear space on all four sides equals the height of the ampersand.
              Never stretch, rotate, recolour, add effects, or rebuild the
              wordmark. Stacked lock-up is primary; horizontal only for shallow
              spaces. Request artwork from marketing — do not lift from a
              document or website.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {LOCK_UPS.map((lockUp) => (
                <li key={lockUp.name}>
                  <span className="font-medium text-foreground">
                    {lockUp.name}
                  </span>
                  <span className="text-muted"> — {lockUp.role}</span>
                </li>
              ))}
            </ul>
            {showDownloads ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={logoUrl}
                  download="peters-and-may-logo.png"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                >
                  <Download className="h-4 w-4" />
                  Download logo
                </a>
                <a
                  href={guideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                >
                  <Download className="h-4 w-4" />
                  Brand guidelines PDF
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Colour palette
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-muted">
          Navy leads brand and marketing; white leads documents and dashboards.
          P&amp;M Blue is the single accent. Ensign Red stays in the logo only.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PALETTE_SWATCHES.map((color) => (
            <article key={color.hex} className="surface-card overflow-hidden">
              <div
                className="h-24 w-full"
                style={{ background: color.hex }}
                aria-hidden
              />
              <div className="p-4">
                <p className="font-medium">{color.name}</p>
                <p className="mt-1 font-mono text-sm text-muted">{color.hex}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {color.role}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card p-6 md:p-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Typography
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p
              className="text-2xl font-bold tracking-tight text-brand md:text-3xl"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {TYPOGRAPHY.display.family}
            </p>
            <p className="mt-2 text-sm text-muted">{TYPOGRAPHY.display.use}</p>
          </div>
          <div>
            <p
              className="text-xl font-medium text-foreground md:text-2xl"
              style={{ fontFamily: "var(--font-sans), sans-serif" }}
            >
              {TYPOGRAPHY.body.family}
            </p>
            <p className="mt-2 text-sm text-muted">{TYPOGRAPHY.body.use}</p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {TYPOGRAPHY.fallback.family} for operational documents.{" "}
          {TYPOGRAPHY.logo.family} is in the logo artwork only — never retype
          the logotype. Sentence case for headlines; 16px minimum on screen.
        </p>
      </section>

      <section className="surface-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Brand summary for AI tools
            </h2>
            <p className="mt-1 text-sm text-muted">
              Paste into drafting tools so first drafts stay on-brand. No company
              figures — use the dated factsheet for those.
            </p>
          </div>
          <button
            type="button"
            onClick={copyAiSummary}
            className="btn-secondary"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy summary"}
          </button>
        </div>
        <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-sand/40 p-4 text-xs leading-relaxed text-foreground">
          {BRAND_AI_SUMMARY}
        </pre>
      </section>

      {showDownloads ? (
        <div>
          <a
            href={guideUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            Download full brand guidelines
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
