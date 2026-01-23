"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBranding } from "@/contexts/BrandingContext"
import { createClient } from "@/lib/supabase/client"
import { Upload, Save } from "lucide-react"
import { useRouter } from "next/navigation"

// Helper function to convert HSL to hex
function hslToHex(hsl: string): string {
  if (hsl.startsWith('#')) {
    return hsl
  }
  
  // Parse HSL string: hsl(h, s%, l%)
  const match = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/)
  if (!match) {
    return '#f1f5f9' // Default fallback
  }
  
  const h = parseFloat(match[1]) / 360
  const s = parseFloat(match[2]) / 100
  const l = parseFloat(match[3]) / 100
  
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  
  return `#${f(0)}${f(8)}${f(4)}`
}

export default function SettingsBrandingTab() {
  const router = useRouter()
  const { settings } = useBranding()
  const [brandName, setBrandName] = useState(settings?.brand_name || "")
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url || "")
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || "hsl(222.2, 47.4%, 11.2%)")
  const [accentColor, setAccentColor] = useState(settings?.accent_color || "hsl(210, 40%, 96.1%)")
  const [sidebarColor, setSidebarColor] = useState(settings?.sidebar_color || "#ffffff")
  const [sidebarTextColor, setSidebarTextColor] = useState(settings?.sidebar_text_color || "#4b5563")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSaveRef = useRef<number>(0)

  useEffect(() => {
    if (settings) {
      setBrandName(settings.brand_name || "")
      setLogoUrl(settings.logo_url || "")
      setPrimaryColor(settings.primary_color || "hsl(222.2, 47.4%, 11.2%)")
      setAccentColor(settings.accent_color || "hsl(210, 40%, 96.1%)")
      setSidebarColor(settings.sidebar_color || "#ffffff")
      setSidebarTextColor(settings.sidebar_text_color || "#4b5563")
    }
  }, [settings])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const supabase = createClient()
      const fileExt = (file?.name || '').split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const filePath = `branding/${fileName}`

      // Upload to Supabase Storage - try 'attachments' bucket first, fallback to 'public'
      let uploadError = null
      let publicUrl = null
      
      // Try attachments bucket first (most likely to exist)
      const { error: attachmentsError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (!attachmentsError) {
        const { data: { publicUrl: url } } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath)
        publicUrl = url
      } else {
        // Try public bucket
        const { error: publicError } = await supabase.storage
          .from('public')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })
        
        if (publicError) {
          uploadError = publicError
        } else {
          const { data: { publicUrl: url } } = supabase.storage
            .from('public')
            .getPublicUrl(filePath)
          publicUrl = url
        }
      }

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        // If bucket doesn't exist, suggest creating it or using a URL instead
        if (uploadError.message?.includes('Bucket not found')) {
          alert('Storage bucket not found. Please create an "attachments" or "public" bucket in Supabase Storage, or enter a logo URL directly.')
          return
        }
        throw uploadError
      }

      if (!publicUrl) {
        throw new Error('Failed to get public URL for uploaded file')
      }

      setLogoUrl(publicUrl!)
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSave() {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    // Prevent rapid successive saves (debounce)
    const now = Date.now()
    const timeSinceLastSave = now - lastSaveRef.current
    if (timeSinceLastSave < 1000 && lastSaveRef.current > 0) {
      // If saved less than 1 second ago, debounce
      saveTimeoutRef.current = setTimeout(() => {
        handleSave()
      }, 1000 - timeSinceLastSave)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        brand_name: brandName || null,
        logo_url: logoUrl || null,
        primary_color: primaryColor || null,
        accent_color: accentColor || null,
        sidebar_color: sidebarColor || null,
        sidebar_text_color: sidebarTextColor || null,
      }
      
      console.log('Saving branding settings:', payload)
      
      const response = await fetch('/api/workspace-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Save failed with response:', error)
        throw new Error(error.error || 'Failed to save settings')
      }

      const result = await response.json()
      console.log('Save successful:', result)
      
      lastSaveRef.current = Date.now()
      
      // Refresh to apply changes
      router.refresh()
    } catch (error) {
      console.error('Error saving branding:', error)
      alert('Failed to save branding settings: ' + (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>
          Customize your workspace appearance with branding colors and logo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="brand-name">Brand Name</Label>
          <Input
            id="brand-name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Marketing Hub"
          />
          <p className="text-xs text-muted-foreground">
            This name appears in the sidebar header
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo">Logo</Label>
          <div className="flex items-center gap-4">
            {logoUrl && (
              <div className="relative h-12 w-12 border border-gray-200 rounded overflow-hidden">
                <Image
                  src={logoUrl}
                  alt="Logo preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <div className="flex-1">
              <Input
                id="logo-url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter a URL or upload an image
              </p>
            </div>
            <div>
              <input
                type="file"
                id="logo-upload"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('logo-upload')?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex gap-2">
              <Input
                id="primary-color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="hsl(222.2, 47.4%, 11.2%)"
              />
              <input
                type="color"
                value={hslToHex(primaryColor)}
                onChange={(e) => {
                  // Convert hex to HSL for consistency
                  const hex = e.target.value
                  const r = parseInt(hex.slice(1, 3), 16) / 255
                  const g = parseInt(hex.slice(3, 5), 16) / 255
                  const b = parseInt(hex.slice(5, 7), 16) / 255
                  
                  const max = Math.max(r, g, b)
                  const min = Math.min(r, g, b)
                  let h = 0, s = 0
                  const l = (max + min) / 2
                  
                  if (max !== min) {
                    const d = max - min
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                    switch (max) {
                      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
                      case g: h = ((b - r) / d + 2) / 6; break
                      case b: h = ((r - g) / d + 4) / 6; break
                    }
                  }
                  
                  setPrimaryColor(`hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`)
                }}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for sidebar header, active items, and primary buttons
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accent-color">Accent Color</Label>
            <div className="flex gap-2">
              <Input
                id="accent-color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="hsl(210, 40%, 96.1%)"
              />
              <input
                type="color"
                value={hslToHex(accentColor)}
                onChange={(e) => {
                  const hex = e.target.value
                  const r = parseInt(hex.slice(1, 3), 16) / 255
                  const g = parseInt(hex.slice(3, 5), 16) / 255
                  const b = parseInt(hex.slice(5, 7), 16) / 255
                  
                  const max = Math.max(r, g, b)
                  const min = Math.min(r, g, b)
                  let h = 0, s = 0
                  const l = (max + min) / 2
                  
                  if (max !== min) {
                    const d = max - min
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                    switch (max) {
                      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
                      case g: h = ((b - r) / d + 2) / 6; break
                      case b: h = ((r - g) / d + 4) / 6; break
                    }
                  }
                  
                  setAccentColor(`hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`)
                }}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for secondary elements and backgrounds
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sidebar-color">Sidebar Background Color</Label>
            <div className="flex gap-2">
              <Input
                id="sidebar-color"
                value={sidebarColor}
                onChange={(e) => setSidebarColor(e.target.value)}
                placeholder="#ffffff"
              />
              <input
                type="color"
                value={sidebarColor.startsWith('#') ? sidebarColor : '#ffffff'}
                onChange={(e) => setSidebarColor(e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Background color for the sidebar (use hex format, e.g., #ffffff)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sidebar-text-color">Sidebar Text Color</Label>
            <div className="flex gap-2">
              <Input
                id="sidebar-text-color"
                value={sidebarTextColor}
                onChange={(e) => setSidebarTextColor(e.target.value)}
                placeholder="#4b5563"
              />
              <input
                type="color"
                value={sidebarTextColor.startsWith('#') ? sidebarTextColor : '#4b5563'}
                onChange={(e) => setSidebarTextColor(e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Text color for sidebar navigation items (use hex format, e.g., #4b5563)
            </p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
