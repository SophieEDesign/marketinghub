import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/shell/BrandLockup";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Image
        src="/home-background.png"
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[rgba(11,58,74,0.9)] via-[rgba(11,58,74,0.58)] to-[rgba(11,58,74,0.18)]"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(11,58,74,0.55)] via-transparent to-transparent md:from-[rgba(11,58,74,0.35)]" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-10 md:py-10">
        <header className="flex justify-end">
          <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm">
            <BrandMark size={44} />
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center pb-8 pt-16 md:max-w-xl md:pb-16 md:pt-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
            Peters &amp; May
          </p>
          <h1 className="mt-3 font-display text-5xl leading-[1.05] text-white md:text-6xl">
            Marketing Hub
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 md:text-lg">
            Events, content, sponsorships, and contacts for the team — plus a
            public gallery for logos and assets.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/login" className="btn-primary">
              Staff login
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/media"
              className="btn border border-white/45 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
            >
              Browse media gallery
            </Link>
          </div>

          <p className="mt-6 text-sm text-white/75">
            Need an account?{" "}
            <Link
              href="/request-access"
              className="font-medium text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white"
            >
              Request access
            </Link>
          </p>
        </main>
      </div>
    </div>
  );
}
