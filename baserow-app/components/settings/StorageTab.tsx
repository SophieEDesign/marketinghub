"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function SettingsStorageTab() {
  const [bucketName, setBucketName] = useState<string>('')
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStorageInfo()
  }, [])

  async function loadStorageInfo() {
    setLoading(true)
    try {
      const supabase = createClient()
      
      // Default bucket name for attachments
      const defaultBucket = 'attachments'
      setBucketName(defaultBucket)

      // Try to get file count from storage
      try {
        const { data: files, error } = await supabase.storage
          .from(defaultBucket)
          .list('', {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' }
          })

        if (!error && files) {
          setFileCount(files.length)
        } else {
          setFileCount(null)
        }
      } catch (error) {
        // Bucket might not exist or be accessible
        setFileCount(null)
      }
    } catch (error) {
      console.error('Error loading storage info:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading storage information...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>Monitor your storage usage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-gray-50">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Storage Bucket</span>
                <span className="text-sm text-muted-foreground font-mono">{bucketName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Files</span>
                <span className="text-sm text-muted-foreground">
                  {fileCount !== null ? fileCount.toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
              Storage is used for file attachments and uploaded media. File management is available in the table views.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
