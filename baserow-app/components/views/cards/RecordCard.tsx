"use client"

import { ChevronRight, Image as ImageIcon } from "lucide-react"
import Image from "next/image"
import AccentCard from "@/components/interface/primitives/AccentCard"
import type { TableField } from "@/types/fields"
import { formatDateUK } from "@/lib/utils"
import { renderPills } from "@/lib/ui/pills"
import { cn } from "@/lib/utils"
import { TEXT_CARD_TITLE } from "@/lib/interface/typography-tokens"
import type { ReactNode } from "react"

type ImageDisplayMode = "show_if_available" | "placeholder" | "hide_when_empty"
type TextBehaviour = "wrap" | "truncate_1" | "truncate_2" | "truncate_3"

interface RecordCardProps {
  recordId: string
  rowData: Record<string, any>
  fields: TableField[]
  primaryFieldName?: string
  secondaryFieldNames?: string[]
  imageFieldName?: string | null
  imageDisplayMode?: ImageDisplayMode
  showFieldLabels?: boolean
  showEmptyFields?: boolean
  textBehaviour?: TextBehaviour
  fixedHeightPx?: number | null
  selected?: boolean
  borderColor?: string | null
  onOpen: (recordId: string) => void
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

function textClampClass(textBehaviour: TextBehaviour): string {
  if (textBehaviour === "truncate_1") return "line-clamp-1"
  if (textBehaviour === "truncate_2") return "line-clamp-2"
  if (textBehaviour === "truncate_3") return "line-clamp-3"
  return "whitespace-normal break-words"
}

function formatValue(field: TableField, value: any): ReactNode {
  if (isEmptyValue(value)) return "—"

  if (field.type === "single_select" || field.type === "multi_select") {
    const values = Array.isArray(value) ? value.map(String) : [String(value)]
    return <span className="inline-flex flex-wrap gap-1">{renderPills(field, values.slice(0, 3), { density: "compact" })}</span>
  }

  if (field.type === "checkbox") {
    return (
      <span className="inline-flex rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-foreground/80">
        {value ? "Yes" : "No"}
      </span>
    )
  }

  if (field.type === "date") return formatDateUK(value)
  if (field.type === "attachment") {
    const count = Array.isArray(value) ? value.length : 0
    return `${count} file${count === 1 ? "" : "s"}`
  }

  return String(value)
}

export default function RecordCard({
  recordId,
  rowData,
  fields,
  primaryFieldName,
  secondaryFieldNames = [],
  imageFieldName = null,
  imageDisplayMode = "show_if_available",
  showFieldLabels = false,
  showEmptyFields = false,
  textBehaviour = "wrap",
  fixedHeightPx = null,
  selected = false,
  borderColor = null,
  onOpen,
}: RecordCardProps) {
  const primaryField = fields.find((f) => f.name === primaryFieldName || f.id === primaryFieldName) ?? null
  const primaryValue = primaryField ? rowData[primaryField.name] : (rowData[primaryFieldName || ""] ?? rowData.name ?? "Untitled")
  const secondaryFields = secondaryFieldNames
    .map((name) => fields.find((f) => f.name === name || f.id === name))
    .filter(Boolean) as TableField[]

  const imageValue = imageFieldName ? rowData[imageFieldName] : null
  const imageUrl =
    Array.isArray(imageValue) && imageValue[0] && typeof imageValue[0] === "object"
      ? (imageValue[0] as any).url
      : Array.isArray(imageValue) && typeof imageValue[0] === "string"
        ? imageValue[0]
        : typeof imageValue === "string"
          ? imageValue
          : null

  const showImageArea =
    imageDisplayMode === "placeholder" ||
    (imageDisplayMode === "show_if_available" && !!imageUrl) ||
    (imageDisplayMode === "hide_when_empty" && !!imageUrl)

  return (
    <AccentCard
      density="compact"
      accentColor={borderColor}
      accentPosition={borderColor ? "left" : "none"}
      selected={selected}
      interactive
      className="w-full max-w-none"
      style={{
        minHeight: 120,
        height: fixedHeightPx && fixedHeightPx > 0 ? fixedHeightPx : undefined,
      }}
      onDoubleClick={() => onOpen(recordId)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showImageArea && (
            <div className="mb-2 h-10 w-10 overflow-hidden rounded-inner border border-border/40 bg-muted/40">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </span>
              )}
            </div>
          )}

          <p className={cn(TEXT_CARD_TITLE, textClampClass(textBehaviour), textBehaviour === "wrap" && "line-clamp-2")}>
            {isEmptyValue(primaryValue) ? "Untitled" : String(primaryValue)}
          </p>

          <div className="mt-1.5 space-y-1">
            {secondaryFields.map((field) => {
              const value = rowData[field.name]
              if (!showEmptyFields && isEmptyValue(value)) return null
              return (
                <div key={field.id || field.name} className="min-w-0 text-xs text-muted-foreground">
                  {showFieldLabels && <span className="mr-1 text-muted-foreground/80">{field.name}:</span>}
                  <span className={cn("min-w-0", textBehaviour === "wrap" ? "whitespace-normal break-words" : textClampClass(textBehaviour))}>
                    {formatValue(field, value)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen(recordId)
          }}
          className="h-7 w-7 shrink-0 rounded-inner text-muted-foreground hover:bg-muted/60 hover:text-foreground ring-accent-focus"
          aria-label="Open record"
          title="Open record"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </AccentCard>
  )
}
