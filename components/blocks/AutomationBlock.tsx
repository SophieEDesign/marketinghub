'use client'

import type { ViewBlock } from '@/types/database'

interface AutomationBlockProps {
  block: ViewBlock
}

export default function AutomationBlock({ block }: AutomationBlockProps) {
  const automationId = block.settings?.automationId || ''
  const status = block.settings?.status || 'inactive'

  return (
    <div className="w-full h-full">
      <div className="text-sm text-muted-foreground mb-2">Automation Block</div>
      <div className="bg-muted rounded p-4">
        <div>Automation ID: {automationId || 'Not configured'}</div>
        <div className="text-xs mt-2">Status: {status}</div>
      </div>
    </div>
  )
}
