"use client"

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Grid, FileText, Columns, Calendar, Layout, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { View } from '@/types/database'

interface ViewCardProps {
  view: View
  tableId: string
  href: string
}

const viewIcons = {
  grid: Grid,
  form: FileText,
  kanban: Columns,
  calendar: Calendar,
  gallery: Layout,
  page: FileText,
}

export default function ViewCard({ view, tableId, href }: ViewCardProps) {
  const Icon = viewIcons[view.type as keyof typeof viewIcons] || Grid

  return (
    <Link href={href} className="block">
      <Card className="group relative h-32 hover:shadow-md transition-all duration-200 border-gray-200 hover:border-gray-300 cursor-pointer">
        <CardContent className="p-4 h-full flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                <Icon className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-gray-900 truncate">{view.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5 capitalize">{view.type} view</p>
              </div>
            </div>
          </div>
          
          <div className="mt-auto pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="capitalize">{view.type}</span>
              <MoreVertical className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
