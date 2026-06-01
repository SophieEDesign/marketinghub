"use client"

import { FileText, Layout } from "lucide-react"
import EmptyState from "./EmptyState"
import { EmptyInterfaceIllustration } from "./EmptyStateIllustrations"

interface EmptyInterfaceStateProps {
  onAddBlock?: (type: string) => void
  suggestedBlocks?: Array<{ type: string; label: string; icon?: React.ReactNode }>
}

export default function EmptyInterfaceState({
  onAddBlock,
  suggestedBlocks = [
    { type: 'grid', label: 'Grid View', icon: <Layout className="h-4 w-4" /> },
    { type: 'text', label: 'Text Block', icon: <FileText className="h-4 w-4" /> },
  ],
}: EmptyInterfaceStateProps) {
  return (
    <EmptyState
      illustration={<EmptyInterfaceIllustration className="w-28 h-20" />}
      title="This interface is empty"
      description="Add blocks to build your interface. Start with a grid view, chart, or text block."
    >
      {onAddBlock && suggestedBlocks.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {suggestedBlocks.map((block) => (
            <button
              key={block.type}
              onClick={() => onAddBlock(block.type)}
              className="flex flex-col items-center gap-2 p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              {block.icon}
              <span className="text-sm font-medium text-foreground">{block.label}</span>
            </button>
          ))}
        </div>
      )}
    </EmptyState>
  )
}

