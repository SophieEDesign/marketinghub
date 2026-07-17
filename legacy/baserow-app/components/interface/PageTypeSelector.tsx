"use client"

import { useState } from "react"
import type { PageTypeTemplate } from "@/lib/interface/pageTypes.types"

interface PageTypeSelectorProps {
  pageTypes: PageTypeTemplate[]
  selectedType: string
  onSelect: (type: string) => void
  isLoading?: boolean
}

const categoryLabels: Record<string, string> = {
  browse_plan: "Browse & Plan",
  create_review: "Create & Review",
  insights: "Insights",
  advanced: "Advanced",
  other: "Other",
}

export default function PageTypeSelector({
  pageTypes,
  selectedType,
  onSelect,
  isLoading = false,
}: PageTypeSelectorProps) {
  // Group page types by category
  const groupedTypes = pageTypes.reduce((acc, template) => {
    const category = template.category || "other"
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(template)
    return acc
  }, {} as Record<string, PageTypeTemplate[]>)

  // Sort templates within each category by order_index
  Object.keys(groupedTypes).forEach((category) => {
    groupedTypes[category].sort((a, b) => a.order_index - b.order_index)
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-24 bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedTypes).map(([category, templates]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            {categoryLabels[category] || category}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {templates.map((template) => (
              <button
                key={template.type}
                onClick={() => onSelect(template.type)}
                className={`relative p-4 border-2 rounded-lg transition-all text-left hover:shadow-md ${
                  selectedType === template.type
                    ? "border-blue-600 bg-blue-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                {selectedType === template.type && (
                  <div className="absolute top-2 right-2">
                    <div className="h-5 w-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">
                    {template.icon || "📄"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 mb-1">
                      {template.label}
                    </div>
                    {template.description && (
                      <div className="text-xs text-gray-500 line-clamp-2">
                        {template.description}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

