"use client"

import { FolderOpen, MoreHorizontal, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getFileTypeBadgeClasses,
  type MockResource,
} from "./types"

interface ResourceListProps {
  resources: MockResource[]
  onSelect?: (id: string) => void
  onViewAll?: () => void
  onAddResource?: () => void
}

function fileIcon(fileType: MockResource["fileType"]) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase",
        getFileTypeBadgeClasses(fileType)
      )}
    >
      {fileType.length <= 4 ? fileType : fileType.slice(0, 3)}
    </span>
  )
}

export default function ResourceList({
  resources,
  onSelect,
  onViewAll,
  onAddResource,
}: ResourceListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 divide-y divide-[#E6E6EF] overflow-y-auto">
        {resources.map((resource) => (
          <li key={resource.id}>
            <button
              type="button"
              onClick={() => onSelect?.(resource.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F8F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D4AFF]/30"
            >
              {fileIcon(resource.fileType)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#111827]">
                  {resource.title}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {resource.fileType}
                  {resource.updatedAt ? ` · ${resource.updatedAt}` : ""}
                </p>
              </div>
              <MoreHorizontal
                className="h-4 w-4 shrink-0 text-[#6B7280]"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
      {onAddResource ? (
        <div className="shrink-0 border-t border-[#E6E6EF] px-4 py-3">
          <button
            type="button"
            onClick={onAddResource}
            className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-[#6D4AFF] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add resource
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function ResourceListHeader({
  title,
  subtitle,
  onViewAll,
  onCreate,
}: {
  title: string
  subtitle: string
  onViewAll?: () => void
  onCreate?: () => void
}) {
  return (
    <header className="shrink-0 border-b border-[#E6E6EF] bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#6D4AFF]">
            <FolderOpen className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#111827]">{title}</h2>
            <p className="text-xs text-[#6B7280]">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#6D4AFF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5a3de6]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Create
            </button>
          ) : null}
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-medium text-[#6D4AFF] hover:underline"
            >
              View all
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
