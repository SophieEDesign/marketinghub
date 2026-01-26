"use client"

import { useState } from "react"
import type { Automation } from "@/types/database"
import AutomationCard from "./AutomationCard"
import AutomationListFilters from "./AutomationListFilters"

interface AutomationsListClientProps {
  automations: Automation[]
}

export default function AutomationsListClient({ automations: initialAutomations }: AutomationsListClientProps) {
  const [filteredAutomations, setFilteredAutomations] = useState<Automation[]>(initialAutomations)

  return (
    <>
      <AutomationListFilters
        automations={initialAutomations}
        onFilterChange={setFilteredAutomations}
      />
      <div className="grid gap-4">
        {filteredAutomations.map((automation) => (
          <AutomationCard key={automation.id} automation={automation} />
        ))}
      </div>
      {filteredAutomations.length === 0 && initialAutomations.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No automations match your filters</p>
        </div>
      )}
    </>
  )
}
