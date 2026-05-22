"use client"

import { Grid3X3 } from "lucide-react"
import ResourceCard from "./ResourceCard"
import type { MockResource } from "./types"

interface ResourceGridProps {
  resources: MockResource[]
  favourites: Set<string>
  onSelect: (id: string) => void
}

export default function ResourceGrid({
  resources,
  favourites,
  onSelect,
}: ResourceGridProps) {
  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Grid3X3 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No resources found</p>
        <p className="text-xs text-muted-foreground/70">
          Try a different category or search term.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {resources.map((r) => (
        <ResourceCard
          key={r.id}
          resource={r}
          isFavourite={favourites.has(r.id)}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
