import { NextRequest, NextResponse } from 'next/server'
import { aggregateTableData, comparePeriods, type AggregateFunction } from '@/lib/dashboard/aggregations'
import { getCachedAggregate, setCachedAggregate, getOrCreatePromise } from '@/lib/dashboard/aggregateCache'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      tableId, 
      aggregate, 
      fieldName, 
      filters,
      comparison,
    } = body

    if (!tableId || !aggregate) {
      return NextResponse.json(
        { error: 'tableId and aggregate are required' },
        { status: 400 }
      )
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
      // Return cached response with cache header
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
        },
      })
    }

    // Use getOrCreatePromise to deduplicate concurrent requests
    const result = await getOrCreatePromise(cacheParams, async () => {
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

    return NextResponse.json(result, {
      headers: {
        'X-Cache': 'MISS',
      },
    })
  } catch (error: any) {
    console.error('Error aggregating data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to aggregate data' },
      { status: 500 }
    )
  }
}

