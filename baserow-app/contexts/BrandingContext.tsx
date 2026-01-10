"use client"

import { createContext, useContext, ReactNode } from 'react'
import type { WorkspaceSettings } from '@/lib/branding'

interface BrandingContextType {
  settings: WorkspaceSettings | null
  brandName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  sidebarColor: string
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

  return (
    <BrandingContext.Provider value={{
      settings,
      brandName,
      logoUrl,
      primaryColor,
      accentColor,
      sidebarColor,
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
