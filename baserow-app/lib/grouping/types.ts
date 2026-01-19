import type { TableField } from '@/types/fields'

export type DateGroupGranularity = 'year' | 'month'

export type GroupRule =
  | {
      type: 'field'
      /** Field name or id; callers should resolve id -> name where possible */
      field: string
    }
  | {
      type: 'date'
      /** Date field name or id; callers should resolve id -> name where possible */
      field: string
      granularity: DateGroupGranularity
    }

export type GroupedLeaf<TItem> = {
  type: 'leaf'
  /** Leaf items, in stable order */
  items: TItem[]
}

export type GroupedNode<TItem> = {
  type: 'group'
  ruleIndex: number
  rule: GroupRule
  /** Stable path key, safe for React keys and collapsed state */
  pathKey: string
  /** Stable key at this level (unencoded) */
  key: string
  /** User-facing label (already formatted) */
  label: string
  /** Value used for sorting at this level (deterministic) */
  sortKey: string | number
  /** Total number of items under this node */
  size: number
  /** Nested groups for the next rule (if any) */
  children: GroupedNode<TItem>[]
  /**
   * Items directly under this group (only populated at the last grouping level).
   * Items are preserved in stable input order.
   */
  items?: TItem[]
}

export type GroupedTree<TItem> = GroupedLeaf<TItem> | GroupedNode<TItem>

export type FlattenedGroupItem<TItem> =
  | { type: 'group'; node: GroupedNode<TItem>; level: number }
  | { type: 'item'; item: TItem; level: number; groupPathKey: string }

export type GroupTreeOptions = {
  /** Label to use for empty values */
  emptyLabel?: string
  /** Whether empty groups should sort last (Airtable-like). Default: true */
  emptyLast?: boolean
}

export type GroupContext = {
  fields: TableField[]
  fieldByName: Map<string, TableField>
  fieldById: Map<string, TableField>
  options: Required<Pick<GroupTreeOptions, 'emptyLabel' | 'emptyLast'>>
}

