import { NextRequest, NextResponse } from 'next/server'
import { aggregateTableData, comparePeriods, type AggregateFunction } from '@/lib/dashboard/aggregations'
import { getCachedAggregate, setCachedAggregate, getOrCreatePromise } from '@/lib/dashboard/aggregateCache'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requests } = body

    if (!Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json(
        { error: 'requests array is required' },
        { status: 400 }
      )
    }

    // Process all requests in parallel
    const results = await Promise.all(
      requests.map(async (req: any) => {
        const {
          tableId,
          aggregate,
          fieldName,
          filters,
          comparison,
        } = req

        if (!tableId || !aggregate) {
          return { error: 'tableId and aggregate are required' }
        }

        // Check cache first
        const cacheParams = {
          tableId,
          aggregate,
          fieldName,
          filters,
          comparison,
        }
        
        const cached = getCachedAggregate(cacheParams)
        if (cached) {
          return cached
        }

        // Use getOrCreatePromise to deduplicate concurrent requests
        return await getOrCreatePromise(cacheParams, async () => {
          // Handle comparison request
          if (comparison) {
            const {
              dateFieldName,
              currentStart,
              currentEnd,
              previousStart,
              previousEnd,
            } = comparison

            if (!dateFieldName || !currentStart || !currentEnd || !previousStart || !previousEnd) {
              throw new Error('Comparison requires dateFieldName and date ranges')
            }

            return await comparePeriods(
              tableId,
              aggregate as AggregateFunction,
              fieldName,
              dateFieldName,
              new Date(currentStart),
              new Date(currentEnd),
              new Date(previousStart),
              new Date(previousEnd),
              filters
            )
          }

          // Regular aggregation
          return await aggregateTableData(
            tableId,
            aggregate as AggregateFunction,
            fieldName,
            filters
          )
        })
      })
    )

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Error aggregating data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to aggregate data' },
      { status: 500 }
    )
  }
}
