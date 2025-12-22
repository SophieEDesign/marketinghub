"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBranding } from "@/contexts/BrandingContext"
import { createClient } from "@/lib/supabase/client"
import { Upload, Save } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SettingsBrandingTab() {
  const router = useRouter()
  const { settings } = useBranding()
  const [brandName, setBrandName] = useState(settings?.brand_name || "")
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url || "")
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || "hsl(222.2, 47.4%, 11.2%)")
  const [accentColor, setAccentColor] = useState(settings?.accent_color || "hsl(210, 40%, 96.1%)")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (settings) {
      setBrandName(settings.brand_name || "")
      setLogoUrl(settings.logo_url || "")
      setPrimaryColor(settings.primary_color || "hsl(222.2, 47.4%, 11.2%)")
      setAccentColor(settings.accent_color || "hsl(210, 40%, 96.1%)")
    }
  }, [settings])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
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
    setIsSaving(true)
    try {
      const response = await fetch('/api/workspace-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brandName || null,
          logo_url: logoUrl || null,
          primary_color: primaryColor || null,
          accent_color: accentColor || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      // Refresh to apply changes
      router.refresh()
    } catch (error) {
      console.error('Error saving branding:', error)
      alert('Failed to save branding settings: ' + (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

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
                value={primaryColor.startsWith('#') ? primaryColor : '#1e293b'}
                onChange={(e) => {
                  // Convert hex to HSL for consistency
                  const hex = e.target.value
                  const r = parseInt(hex.slice(1, 3), 16) / 255
                  const g = parseInt(hex.slice(3, 5), 16) / 255
                  const b = parseInt(hex.slice(5, 7), 16) / 255
                  
                  const max = Math.max(r, g, b)
                  const min = Math.min(r, g, b)
                  let h = 0, s = 0, l = (max + min) / 2
                  
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
                value={accentColor.startsWith('#') ? accentColor : '#f1f5f9'}
                onChange={(e) => {
                  const hex = e.target.value
                  const r = parseInt(hex.slice(1, 3), 16) / 255
                  const g = parseInt(hex.slice(3, 5), 16) / 255
                  const b = parseInt(hex.slice(5, 7), 16) / 255
                  
                  const max = Math.max(r, g, b)
                  const min = Math.min(r, g, b)
                  let h = 0, s = 0, l = (max + min) / 2
                  
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
