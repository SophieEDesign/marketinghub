import { NextRequest, NextResponse } from 'next/server'
import { aggregateTableData, comparePeriods, type AggregateFunction } from '@/lib/dashboard/aggregations'

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
        return NextResponse.json(
          { error: 'Comparison requires dateFieldName and date ranges' },
          { status: 400 }
        )
      }

      const result = await comparePeriods(
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

      return NextResponse.json(result)
    }

    // Regular aggregation
    const result = await aggregateTableData(
      tableId,
      aggregate as AggregateFunction,
      fieldName,
      filters
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error aggregating data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to aggregate data' },
      { status: 500 }
    )
  }
}

