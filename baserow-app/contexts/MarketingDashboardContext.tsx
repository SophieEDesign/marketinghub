"use client"

import { createContext, useContext, type ReactNode } from "react"

const MarketingDashboardContext = createContext(false)

export function MarketingDashboardProvider({ children }: { children: ReactNode }) {
  return (
    <MarketingDashboardContext.Provider value={true}>{children}</MarketingDashboardContext.Provider>
  )
}

export function useMarketingDashboard(): boolean {
  return useContext(MarketingDashboardContext)
}
