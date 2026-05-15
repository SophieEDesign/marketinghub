"use client"

import { Download, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StaffHubAsset } from "@/lib/marketing/internal-staff-hub"
import { cn } from "@/lib/utils"

interface AssetPreviewModalProps {
  asset: StaffHubAsset | null
  onClose: () => void
}

export default function AssetPreviewModal({ asset, onClose }: AssetPreviewModalProps) {
  if (!asset) return null

  const link = asset.link
  const canEmbed = Boolean(link?.embedUrl)
  const isFolder = link?.fileKind === "folder"
  const openUrl = link?.openUrl
  const driveLabel =
    link?.provider === "google_drive" || link?.provider?.startsWith("google")
      ? "Drive"
      : link?.providerLabel ?? "browser"

  return (
    <>
      <div
        className="fixed inset-0 md:left-64 bg-black/30 z-50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-0 md:left-64 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal
        aria-labelledby="asset-preview-title"
      >
        <PreviewDialogPanel
          asset={asset}
          link={link}
          canEmbed={canEmbed}
          isFolder={isFolder}
          openUrl={openUrl}
          driveLabel={driveLabel}
          onClose={onClose}
        />
      </div>
    </>
  )
}

function PreviewDialogPanel({
  asset,
  link,
  canEmbed,
  isFolder,
  openUrl,
  driveLabel,
  onClose,
}: {
  asset: StaffHubAsset
  link: StaffHubAsset["link"]
  canEmbed: boolean
  isFolder: boolean
  openUrl: string | undefined
  driveLabel: string
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-4xl max-h-[90vh] flex flex-col",
        "rounded-card-lg bg-card shadow-elevated border border-border/50 overflow-hidden"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/40">
        <div className="min-w-0 flex-1">
          <h2 id="asset-preview-title" className="text-base font-semibold text-foreground truncate">
            {asset.title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {link?.providerLabel ?? "Resource"} · {link?.fileKindLabel ?? asset.type ?? "File"}
          </p>
          {asset.description ? (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{asset.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-muted/20">
        {canEmbed && link?.embedUrl ? (
          <iframe
            src={link.embedUrl}
            title={asset.title}
            className={cn(
              "w-full border-0 bg-background",
              isFolder ? "h-[min(72vh,640px)]" : "h-[min(60vh,520px)]"
            )}
            allow="autoplay"
          />
        ) : asset.previewUrl ? (
          <div className="flex items-center justify-center p-6 min-h-[240px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.previewUrl}
              alt=""
              className="max-h-[min(50vh,400px)] max-w-full rounded-md object-contain shadow-card"
            />
          </div>
        ) : (
          <EmptyPreview providerLabel={link?.providerLabel} openUrl={openUrl} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-border/40 bg-card">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
        {openUrl ? (
          <>
            {!isFolder ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={openUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </a>
              </Button>
            ) : null}
            <Button type="button" size="sm" asChild>
              <a href={openUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open in {driveLabel}
              </a>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function EmptyPreview({
  providerLabel,
  openUrl,
}: {
  providerLabel: string | undefined
  openUrl: string | undefined
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="text-sm text-muted-foreground">Preview not available for this file type.</p>
      {openUrl ? (
        <p className="text-xs text-muted-foreground/80 mt-1">
          Open in {providerLabel ?? "browser"} to view.
        </p>
      ) : null}
    </div>
  )
}
