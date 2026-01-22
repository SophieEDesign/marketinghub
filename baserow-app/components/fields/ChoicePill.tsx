"use client"

import * as React from "react"
import {
  getTextColorForBackground,
  normalizeHexColor,
  resolveChoiceColor,
} from "@/lib/field-colors"
import type { FieldOptions } from "@/types/fields"
import { cn } from "@/lib/utils"

export type ChoicePillFieldType = "single_select" | "multi_select"

export interface ChoicePillProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string
  fieldType: ChoicePillFieldType
  fieldOptions?: FieldOptions
  /**
   * When true, uses the "semantic" palette (stronger colors).
   * Defaults to true for single-select, false for multi-select.
   */
  useSemanticColors?: boolean
  /**
   * Visual density. Keep this consistent across the app unless a view explicitly
   * needs a tighter layout (e.g. very compact cards).
   */
  density?: "default" | "compact"
}

export function ChoicePill({
  label,
  fieldType,
  fieldOptions,
  useSemanticColors,
  density = "default",
  className,
  style,
  ...props
}: ChoicePillProps) {
  const normalized = String(label ?? "").trim()
  const semantic =
    typeof useSemanticColors === "boolean" ? useSemanticColors : fieldType === "single_select"

  const hexColor = resolveChoiceColor(normalized, fieldType, fieldOptions, semantic)
  const textColorClass = getTextColorForBackground(hexColor)
  const bgColor = normalizeHexColor(hexColor)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md text-xs font-medium",
        density === "compact" ? "px-2 py-0.5" : "px-2 py-0.5",
        textColorClass,
        className
      )}
      style={{ 
        backgroundColor: bgColor, 
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...style 
      }}
      title={normalized}
      {...props}
    >
      {normalized}
    </span>
  )
}

export interface ChoicePillListProps extends React.HTMLAttributes<HTMLDivElement> {
  labels: string[]
  fieldType: ChoicePillFieldType
  fieldOptions?: FieldOptions
  /** Max pills to render before collapsing into a +N pill. */
  max?: number
  density?: "default" | "compact"
}

export function ChoicePillList({
  labels,
  fieldType,
  fieldOptions,
  max,
  density = "default",
  className,
  ...props
}: ChoicePillListProps) {
  const safe = (Array.isArray(labels) ? labels : []).map((l) => String(l ?? "").trim()).filter(Boolean)
  const shown = typeof max === "number" ? safe.slice(0, Math.max(0, max)) : safe
  const remaining = typeof max === "number" ? Math.max(0, safe.length - shown.length) : 0

  return (
    <div className={cn("flex flex-wrap gap-1 items-start", className)} {...props}>
      {shown.map((val) => (
        <ChoicePill
          key={val}
          label={val}
          fieldType={fieldType}
          fieldOptions={fieldOptions}
          density={density}
        />
      ))}
      {remaining > 0 && (
        <span className={cn("px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-500 whitespace-nowrap")}>
          +{remaining}
        </span>
      )}
    </div>
  )
}

