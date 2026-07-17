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
        className="absolute inset-0 bg-gradient-to-r from-[rgba(11,58,74,0.88)] via-[rgba(11,58,74,0.55)] to-[rgba(11,58,74,0.2)]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <BrandMark size={64} className="mb-8" />
        <h1 className="font-display text-5xl leading-tight text-white md:text-6xl">
          Marketing Hub
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/85">
          Events, content, sponsorships, media, and contacts — one simple place
          for the marketing team, with a public media gallery for sharing logos
          and assets.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn-primary">
            Staff login
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/media"
            className="btn border border-white/40 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25"
          >
            Browse media gallery
          </Link>
        </div>
      </div>
    </div>
  );
}
