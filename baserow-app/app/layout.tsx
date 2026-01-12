import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import CommandPaletteProvider from "@/components/command-palette/CommandPaletteProvider"
import DynamicTitle from "@/components/layout/DynamicTitle"
import DiagnosticsInitializer from "@/components/layout/DiagnosticsInitializer"
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
  
  // Default favicon (emoji SVG)
  const defaultFavicon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>'
  
  return {
    title: {
      default: settings?.brand_name || "Baserow App",
      template: `%s | ${settings?.brand_name || "Baserow App"}`,
    },
    description: "A Baserow-style interface built with Next.js and Supabase",
    icons: {
      icon: logoUrl 
        ? [{ url: logoUrl, type: 'image/png' }]
        : [{ url: defaultFavicon }],
    },
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
          <DiagnosticsInitializer />
          <DynamicTitle />
          {children}
          <Toaster />
          <CommandPaletteProvider />
        </SWRProvider>
      </body>
    </html>
  )
}
