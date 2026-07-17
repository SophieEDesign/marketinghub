"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import LoginBrandPanel from "./LoginBrandPanel"

interface LoginLayoutProps {
  brandName: string
  logoUrl?: string | null
  brandHeading?: string
  brandSubtext?: string
  children: React.ReactNode
  className?: string
}

export default function LoginLayout({
  brandName,
  logoUrl,
  brandHeading,
  brandSubtext,
  children,
  className,
}: LoginLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-hub-canvas p-4 md:p-8",
        className
      )}
    >
      <div className="w-full max-w-[920px] overflow-hidden rounded-2xl bg-card shadow-elevated">
        <div className="grid min-h-[520px] grid-cols-1 md:grid-cols-[minmax(280px,1fr)_minmax(320px,1.1fr)]">
          <LoginBrandPanel
            brandName={brandName}
            logoUrl={logoUrl}
            heading={brandHeading}
            subtext={brandSubtext}
            className="min-h-[200px] md:min-h-0"
          />
          <div className="flex flex-col justify-center px-6 py-8 md:px-10 md:py-10">{children}</div>
        </div>
      </div>
    </div>
  )
}
