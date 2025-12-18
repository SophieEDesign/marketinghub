"use client"

import React from 'react'
import {
  Type,
  FileText,
  Hash,
  Percent,
  DollarSign,
  Calendar,
  List,
  CheckSquare,
  Paperclip,
  Link2,
  Calculator,
  Search,
  Mail,
  Globe,
} from 'lucide-react'
import type { FieldType } from '@/types/fields'

export function getFieldIcon(type: FieldType | string): React.ReactElement {
  const iconClass = "h-3.5 w-3.5 text-gray-500"
  switch (type) {
    case "text":
      return <Type className={iconClass} />
    case "long_text":
      return <FileText className={iconClass} />
    case "number":
      return <Hash className={iconClass} />
    case "percent":
      return <Percent className={iconClass} />
    case "currency":
      return <DollarSign className={iconClass} />
    case "date":
      return <Calendar className={iconClass} />
    case "single_select":
    case "multi_select":
      return <List className={iconClass} />
    case "checkbox":
      return <CheckSquare className={iconClass} />
    case "attachment":
      return <Paperclip className={iconClass} />
    case "link_to_table":
      return <Link2 className={iconClass} />
    case "formula":
      return <Calculator className={iconClass} />
    case "lookup":
      return <Search className={iconClass} />
    case "email":
      return <Mail className={iconClass} />
    case "url":
      return <Globe className={iconClass} />
    default:
      return <Type className={iconClass} />
  }
}
