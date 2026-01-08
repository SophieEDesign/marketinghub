'use client'

import { SWRConfig } from 'swr'

/**
 * SWR Provider for request deduplication and caching
 * Wraps the app to enable SWR hooks throughout
 */
export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Default deduplication interval (5 seconds)
        dedupingInterval: 5000,
        // Don't refetch on focus/reconnect for dashboard data
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        // Keep previous data while loading new data
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
