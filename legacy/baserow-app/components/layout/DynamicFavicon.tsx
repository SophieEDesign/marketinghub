"use client"

import { useEffect } from "react"
import { useBranding } from "@/contexts/BrandingContext"

export default function DynamicFavicon() {
  const { logoUrl } = useBranding()

  useEffect(() => {
    // Default favicon (emoji SVG)
    const defaultFavicon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>'
    
    // Find existing favicon link or create a new one
    let faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement
    
    if (!faviconLink) {
      // Create new favicon link if it doesn't exist
      faviconLink = document.createElement("link")
      faviconLink.rel = "icon"
      document.head.appendChild(faviconLink)
    }

    // Update favicon URL
    if (logoUrl) {
      faviconLink.href = logoUrl
      faviconLink.type = "image/png"
    } else {
      faviconLink.href = defaultFavicon
      faviconLink.type = "image/svg+xml"
    }
  }, [logoUrl])

  return null // This component doesn't render anything
}
