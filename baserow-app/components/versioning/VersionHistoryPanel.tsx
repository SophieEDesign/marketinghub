"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Clock, User, RotateCcw, Eye, Loader2 } from "lucide-react"
import { getVersionsClient, restoreVersionClient } from "@/lib/versioning/versioning.client"
import { useToast } from "@/components/ui/use-toast"
import type { EntityType, EntityVersion } from "@/lib/versioning/versioning"

interface VersionHistoryPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: EntityType
  entityId: string
  onRestore?: (version: EntityVersion) => void
}

export default function VersionHistoryPanel({
  open,
  onOpenChange,
  entityType,
  entityId,
  onRestore,
}: VersionHistoryPanelProps) {
  const { toast } = useToast()
  const [versions, setVersions] = useState<EntityVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState<EntityVersion | null>(null)

  useEffect(() => {
    if (open && entityId) {
      loadVersions()
    }
  }, [open, entityId, entityType])

  async function loadVersions() {
    setLoading(true)
    try {
      const data = await getVersionsClient(entityType, entityId, 50)
      setVersions(data)
    } catch (error: any) {
      console.error("Error loading versions:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load version history",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(version: EntityVersion) {
    if (!confirm(`Are you sure you want to restore version ${version.version_number}? This will create a new version entry.`)) {
      return
    }

    setRestoring(version.id)
    try {
      const restored = await restoreVersionClient(entityType, entityId, version.version_number)
      toast({
        title: "Version restored",
        description: `Restored to version ${restored.version_number}`,
      })
      
      // Reload versions
      await loadVersions()
      
      // Notify parent
      if (onRestore) {
        onRestore(restored)
      }
    } catch (error: any) {
      console.error("Error restoring version:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to restore version",
        variant: "destructive",
      })
    } finally {
      setRestoring(null)
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  }

  function getReasonBadge(reason: string) {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      manual_save: "default",
      autosave: "secondary",
      rollback: "outline",
      restore: "outline",
    }
    return variants[reason] || "default"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>
            View and restore previous versions of this {entityType}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Clock className="h-12 w-12 mb-4 text-gray-300" />
            <p className="text-sm">No version history yet</p>
            <p className="text-xs mt-1">Versions will appear here after you save changes</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm">
                          Version {version.version_number}
                        </span>
                        <Badge variant={getReasonBadge(version.reason)} className="text-xs">
                          {version.reason.replace("_", " ")}
                        </Badge>
                        {version.version_number === versions[0]?.version_number && (
                          <Badge variant="outline" className="text-xs">
                            Latest
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(version.created_at)}
                        </div>
                        {version.created_by && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            User
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewVersion(version)}
                        className="h-8"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      {version.version_number !== versions[0]?.version_number && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(version)}
                          disabled={restoring === version.id}
                          className="h-8"
                        >
                          {restoring === version.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>

      {/* Preview Dialog */}
      {previewVersion && (
        <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Preview Version {previewVersion.version_number}</DialogTitle>
              <DialogDescription>
                {formatDate(previewVersion.created_at)} • {previewVersion.reason.replace("_", " ")}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto">
                {JSON.stringify(previewVersion.snapshot, null, 2)}
              </pre>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setPreviewVersion(null)}>
                Close
              </Button>
              <Button onClick={() => {
                setPreviewVersion(null)
                handleRestore(previewVersion)
              }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore This Version
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}

