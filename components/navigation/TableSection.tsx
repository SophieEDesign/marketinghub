'use client'

import Link from 'next/link'
import { Database } from 'lucide-react'
import SidebarItem from './SidebarItem'

interface TableSectionProps {
  tableId: string
  tableName: string
  views: Array<{
    id: string
    name: string
    type: string
  }>
}

/**
 * TableSection - Admin-only table navigation
 * Tables are admin-only. Views are internal-only and not shown in sidebar.
 * Tables link directly to their admin page.
 */
export default function TableSection({
  tableId,
  tableName,
  views, // Not used - views are internal-only
}: TableSectionProps) {
  return (
    <SidebarItem
      id={tableId}
      label={tableName}
      href={`/tables/${tableId}`}
      icon="database"
    />
  )
}
