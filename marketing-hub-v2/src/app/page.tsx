import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/shell/BrandLockup";

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <BrandMark size={48} className="mb-6" />
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Peters &amp; May
        </p>
        <h1 className="font-display text-5xl leading-tight text-brand md:text-6xl">
          Marketing Hub
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Events, content, sponsorships, media, and contacts — one simple place
          for the marketing team, with a public media gallery for sharing logos
          and assets.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn-primary">
            Staff login
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/media" className="btn-secondary">
            Browse media gallery
          </Link>
        </div>
        <p className="mt-10 text-xs text-muted">
          Legacy Airtable-style hub remains available under{" "}
          <code className="rounded bg-white px-1.5 py-0.5">
            legacy/baserow-app
          </code>{" "}
          and is not removed.
        </p>
      </div>
    </div>
  );
}
