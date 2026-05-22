"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface LoginBrandPanelProps {
  brandName: string
  logoUrl?: string | null
  heading?: string
  subtext?: string
  className?: string
}

export default function LoginBrandPanel({
  brandName,
  logoUrl,
  heading = "Welcome back 👋",
  subtext = "Sign in to continue to your marketing command centre.",
  className,
}: LoginBrandPanelProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-center overflow-hidden px-8 py-10 md:px-10 md:py-12",
        "bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-purple-400/20 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-1/4 right-1/4 h-32 w-32 rounded-full bg-indigo-300/15 blur-xl"
        aria-hidden
      />

      <div className="relative z-10">
        <div className="mb-8 flex items-center gap-3">
          {logoUrl ? (
            <div className="relative h-10 w-10 shrink-0">
              <Image
                src={logoUrl}
                alt={brandName}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white">
              MH
            </div>
          )}
          <span className="text-lg font-semibold tracking-tight text-white">{brandName}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{heading}</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">{subtext}</p>
      </div>
    </div>
  )
}
