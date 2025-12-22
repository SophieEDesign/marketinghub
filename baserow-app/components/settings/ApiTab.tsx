"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

export default function SettingsApiTab() {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  function maskValue(value: string): string {
    if (!value || value.length < 8) return '••••••••'
    return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4)
  }

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>Manage your API keys for programmatic access</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              API keys allow you to access your data programmatically. Keep them secure and never share them publicly.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium mb-1">Supabase Project URL</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {maskValue(supabaseUrl)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(supabaseUrl, 'url')}
                  className="flex-shrink-0"
                >
                  {copiedField === 'url' ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium mb-1">Anon Key</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {maskValue(supabaseAnonKey)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(supabaseAnonKey, 'key')}
                  className="flex-shrink-0"
                >
                  {copiedField === 'key' ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These are read-only values from your environment configuration. To change them, update your environment variables.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
