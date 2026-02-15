import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import CommandPaletteProvider from "@/components/command-palette/CommandPaletteProvider"
import DynamicTitle from "@/components/layout/DynamicTitle"
import ConsoleErrorFilter from "@/components/layout/ConsoleErrorFilter"
import DiagnosticsInitializer from "@/components/layout/DiagnosticsInitializer"
import InteractionFailsafe from "@/components/layout/InteractionFailsafe"
import NavigationDiagnostics from "@/components/layout/NavigationDiagnostics"
import NavigationProgress from "@/components/layout/NavigationProgress"
import PerformanceMonitor from "@/components/layout/PerformanceMonitor"
import SWRProvider from "@/components/providers/SWRProvider"
import { getWorkspaceSettings } from "@/lib/branding"

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap', // Optimize font loading - use fallback font while loading
  adjustFontFallback: true, // Improve font fallback behavior
})

export async function generateMetadata(): Promise<Metadata> {
  // Fetch workspace settings to get the logo for favicon
  const settings = await getWorkspaceSettings().catch(() => null)
  const logoUrl = settings?.logo_url || null
  const brandName = settings?.brand_name || "Marketing Hub"
  
  // Default favicon (emoji SVG)
  const defaultFavicon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>'
  
  // Use logo URL for Open Graph image, or default to a better image
  const ogImage = logoUrl || defaultFavicon
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://marketinghub-jet.vercel.app'
  
  return {
    title: {
      default: brandName,
      template: `%s | ${brandName}`,
    },
    description: "Marketing Hub - Streamline your marketing operations with powerful data management and workflow automation",
    icons: {
      icon: logoUrl 
        ? [{ url: logoUrl, type: 'image/png' }]
        : [{ url: defaultFavicon }],
    },
    openGraph: {
      title: brandName,
      description: "Marketing Hub - Streamline your marketing operations with powerful data management and workflow automation",
      url: siteUrl,
      siteName: brandName,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: brandName,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: brandName,
      description: "Marketing Hub - Streamline your marketing operations with powerful data management and workflow automation",
      images: [ogImage],
    },
    metadataBase: new URL(siteUrl),
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SWRProvider>
          <ConsoleErrorFilter />
          <DiagnosticsInitializer />
          <InteractionFailsafe />
          <PerformanceMonitor />
          <NavigationProgress />
          {/* STEP 1: Temporarily disabled to verify not causing heavy message listeners or loops */}
          {/* <NavigationDiagnostics /> */}
          <DynamicTitle />
          {children}
          <Toaster />
          <CommandPaletteProvider />
        </SWRProvider>
      </body>
    </html>
  )
}
