"use client"

import {
  ArrowLeft,
  Maximize2,
  Upload,
  FileText,
  Layout,
  Image as ImageIcon,
  PlusCircle,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import PreviewByType from "./PreviewByType"
import type { MockResource } from "./types"

interface AssetPreviewViewProps {
  resource: MockResource
  variants: MockResource[]
  selectedId: string
  showUpload: boolean
  isEditing?: boolean
  onBack: () => void
  onSelectVariant: (id: string) => void
}

const QUICK_LINKS = [
  {
    title: "Brand Guidelines",
    description: "View the latest guidelines",
    icon: FileText,
  },
  {
    title: "Approved Templates",
    description: "Access brand templates",
    icon: Layout,
  },
  {
    title: "Image Library",
    description: "Browse approved imagery",
    icon: ImageIcon,
  },
  {
    title: "Request an Asset",
    description: "Can't find what you need?",
    icon: PlusCircle,
  },
] as const

export default function AssetPreviewView({
  resource,
  variants,
  selectedId,
  showUpload,
  isEditing,
  onBack,
  onSelectVariant,
}: AssetPreviewViewProps) {
  const displayVariants =
    variants.length > 0 ? variants : [resource]
  const extraCount = Math.max(0, displayVariants.length - 4)

  return (
    <div className="flex flex-col gap-4 p-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all resources
      </button>

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
        <div className="absolute right-3 top-3 z-10">
          <Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5 text-xs shadow-sm">
            <Maximize2 className="h-3.5 w-3.5" />
            Full screen
          </Button>
        </div>
        <div className="aspect-[16/10] min-h-[200px] w-full md:min-h-[280px]">
          <PreviewByType resource={resource} large className="h-full w-full" />
        </div>
      </div>

      {displayVariants.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {displayVariants.slice(0, 4).map((v) => {
            const selected = v.id === selectedId
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVariant(v.id)}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors",
                  selected ? "border-blue-500" : "border-border/60 hover:border-blue-300"
                )}
              >
                <PreviewByType resource={v} className="h-full w-full" />
                {selected && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            )
          })}
          {extraCount > 0 && (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-xs font-medium text-muted-foreground">
              +{extraCount} more
            </div>
          )}
        </div>
      )}

      {showUpload && isEditing && (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center"
          role="presentation"
        >
          {/* TODO: connect upload area to admin/edit mode + Supabase storage */}
          <Upload className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground/80">
            Drag and drop to upload
          </p>
          <p className="text-xs text-muted-foreground">
            or{" "}
            <button type="button" className="text-blue-600 hover:underline">
              browse files
            </button>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <button
              key={link.title}
              type="button"
              className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-card"
            >
              <Icon className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-[#1e3a5f]">{link.title}</span>
              <span className="text-xs text-muted-foreground">{link.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
