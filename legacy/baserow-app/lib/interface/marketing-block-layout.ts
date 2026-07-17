import type { BlockConfig } from "@/lib/interface/types"
import { cn } from "@/lib/utils"

export function isConfigFullPage(config?: BlockConfig | null): boolean {
  return config?.is_full_page === true
}

/**
 * Root shell for marketing/custom interface blocks.
 * Full-page: fill viewport, no card chrome; embedded: pass card border/radius classes.
 */
export function marketingBlockRootClass(
  isFullPage: boolean,
  embeddedClassName: string
): string {
  return cn(
    "flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden",
    isFullPage ? "rounded-none border-0 shadow-none bg-background" : embeddedClassName
  )
}

/** Scrollable main panel inside a marketing block (list, grid, calendar body). */
export function marketingBlockScrollPanelClass(fillContainer: boolean): string {
  return fillContainer
    ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
    : ""
}
