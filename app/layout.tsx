import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Sidebar from "@/components/navigation/Sidebar"
import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap', // Optimize font loading - use fallback font while loading
  adjustFontFallback: true, // Improve font fallback behavior
})

export const metadata: Metadata = {
  title: "Marketing Hub",
  description: "Marketing Hub - Data Management",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen w-full">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
