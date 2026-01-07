import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import CommandPaletteProvider from "@/components/command-palette/CommandPaletteProvider"
import DynamicTitle from "@/components/layout/DynamicTitle"
import DiagnosticsInitializer from "@/components/layout/DiagnosticsInitializer"

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap', // Optimize font loading - use fallback font while loading
  adjustFontFallback: true, // Improve font fallback behavior
})

export const metadata: Metadata = {
  title: {
    default: "Baserow App",
    template: "%s | Baserow App",
  },
  description: "A Baserow-style interface built with Next.js and Supabase",
  icons: {
    icon: [
      { url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>' },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DiagnosticsInitializer />
        <DynamicTitle />
        {children}
        <Toaster />
        <CommandPaletteProvider />
      </body>
    </html>
  )
}
