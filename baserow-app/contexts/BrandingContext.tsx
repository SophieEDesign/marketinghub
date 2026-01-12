"use client"

import { createContext, useContext, useEffect, ReactNode } from 'react'
import type { WorkspaceSettings } from '@/lib/branding'

interface BrandingContextType {
  settings: WorkspaceSettings | null
  brandName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  sidebarColor: string
  sidebarTextColor: string
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined)

export function BrandingProvider({ 
  children, 
  settings 
}: { 
  children: ReactNode
  settings: WorkspaceSettings | null 
}) {
  const brandName = settings?.brand_name || 'Marketing Hub'
  const logoUrl = settings?.logo_url || null
  const primaryColor = settings?.primary_color || 'hsl(222.2, 47.4%, 11.2%)' // Default from theme
  const accentColor = settings?.accent_color || 'hsl(210, 40%, 96.1%)' // Default from theme
  const sidebarColor = settings?.sidebar_color || '#ffffff' // Default white
  // Use primaryColor as the default text color for all text (branding color)
  const sidebarTextColor = settings?.sidebar_text_color || primaryColor

  // Set CSS custom properties for global text color
  useEffect(() => {
    // Convert HSL to RGB if needed for CSS variables
    const setCSSVariable = (name: string, value: string) => {
      document.documentElement.style.setProperty(name, value)
    }
    
    // Set branding color as the default text color
    setCSSVariable('--branding-text-color', primaryColor)
    setCSSVariable('--branding-primary-color', primaryColor)
  }, [primaryColor])

  return (
    <BrandingContext.Provider value={{
      settings,
      brandName,
      logoUrl,
      primaryColor,
      accentColor,
      sidebarColor,
      sidebarTextColor,
    }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const context = useContext(BrandingContext)
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }
  return context
}
