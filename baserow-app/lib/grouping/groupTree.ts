import type { TableField } from '@/types/fields'
import { getOptionValueToLabelMap } from '@/lib/fields/select-options'
import type {
  FlattenedGroupItem,
  GroupContext,
  GroupRule,
  GroupTreeOptions,
  GroupedNode,
} from '@/lib/grouping/types'

type KeyPart = string | number

type GroupKey = {
  key: string
  label: string
  sortKey: string | number
  isEmpty: boolean
}

function safeString(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function isEmptyValue(v: any): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim().length === 0
  if (Array.isArray(v)) return v.length === 0 || v.every((x) => isEmptyValue(x))
  return false
}

function buildContext(fields: TableField[], opts?: GroupTreeOptions): GroupContext {
  const fieldByName = new Map<string, TableField>()
  const fieldById = new Map<string, TableField>()
  for (const f of fields) {
    if (!f) continue
    if (f.name) fieldByName.set(f.name, f)
    if (f.id) fieldById.set(f.id, f)
  }
  return {
    fields,
    fieldByName,
    fieldById,
    options: {
      emptyLabel: opts?.emptyLabel ?? '(Empty)',
      emptyLast: opts?.emptyLast ?? true,
      valueLabelMaps: opts?.valueLabelMaps,
    },
  }
}

function resolveField(ctx: GroupContext, fieldRef: string): TableField | null {
  if (!fieldRef) return null
  return ctx.fieldByName.get(fieldRef) || ctx.fieldById.get(fieldRef) || null
}

function normalizeGroupRuleFieldName(ctx: GroupContext, rule: GroupRule): GroupRule {
  const field = resolveField(ctx, rule.field)
  if (!field) return rule
  return { ...rule, field: field.name } as any
}

function encodeKeyPart(x: KeyPart): string {
  // Keep this short but stable and safe for React keys.
  return encodeURIComponent(String(x))
}

function joinPath(parts: Array<{ ruleIndex: number; key: string }>): string {
  // Example: r0=2026|r1=Open|r2=01
  return parts.map((p) => `r${p.ruleIndex}=${encodeKeyPart(p.key)}`).join('|')
}

function dateToYearKey(date: Date): GroupKey {
  const y = date.getUTCFullYear()
  return { key: String(y), label: String(y), sortKey: y, isEmpty: false }
}

function dateToMonthKey(date: Date): GroupKey {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const ts = Date.UTC(y, m - 1, 1)
  const label = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date)
  return { key: `${y}-${String(m).padStart(2, '0')}`, label, sortKey: ts, isEmpty: false }
}

function parseDateValue(v: any): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  const s = typeof v === 'string' ? v : safeString(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function looksLikeUuid(s: string): boolean {
  return typeof s === 'string' && UUID_RE.test(s.trim())
}

function selectSortIndex(field: TableField, valueLabel: string): number | null {
  const opts = (field as any)?.options?.selectOptions as any[] | undefined
  if (!Array.isArray(opts) || opts.length === 0) return null
  const match = opts.find((o) => String(o?.label ?? '') === valueLabel)
  const idx = match?.sort_index
  return typeof idx === 'number' ? idx : null
}

function getGroupKeysForValue(ctx: GroupContext, rule: GroupRule, field: TableField | null, rawValue: any): GroupKey[] {
  const emptyKey: GroupKey = {
    key: ctx.options.emptyLabel,
    label: ctx.options.emptyLabel,
    sortKey: ctx.options.emptyLast ? Number.POSITIVE_INFINITY : '',
    isEmpty: true,
  }

  if (isEmptyValue(rawValue)) return [emptyKey]

  // Explode arrays (multi-select etc.) into multiple group memberships (Airtable-like).
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  const keys: GroupKey[] = []

  for (const v of values) {
    if (isEmptyValue(v)) continue

    if (rule.type === 'date') {
      const d = parseDateValue(v)
      if (!d) {
        keys.push(emptyKey)
        continue
      }
      keys.push(rule.granularity === 'year' ? dateToYearKey(d) : dateToMonthKey(d))
      continue
    }

    // Field grouping
    // Use the raw stored value for the stable group key (avoid collisions when labels repeat),
    // but render the user-facing label via optional mapping (e.g. link_to_table UUID -> name).
    const rawKey = safeString(v).trim()
    if (!rawKey) {
      keys.push(emptyKey)
      continue
    }

    const resolvedLabel = (() => {
      if (!field) return rawKey
      // 1. For single_select/multi_select: resolve from field options (id -> label, label -> label)
      if (field.type === 'single_select' || field.type === 'multi_select') {
        const optionMap = getOptionValueToLabelMap(field.type, field.options)
        const resolved =
          optionMap.get(rawKey) ??
          (looksLikeUuid(rawKey) ? optionMap.get(rawKey.toLowerCase()) : undefined)
        if (resolved) return resolved
      }
      // 2. External valueLabelMaps (e.g. link_to_table resolved names)
      const maps = ctx.options.valueLabelMaps
      if (maps) {
        const byName = maps[field.name]
        const byId = maps[(field as any)?.id]
        const lookup = (m: Record<string, string> | undefined) =>
          m?.[rawKey] ?? (looksLikeUuid(rawKey) ? m?.[rawKey.toLowerCase()] : undefined)
        const fromMap = lookup(byName as Record<string, string>) ?? lookup(byId as Record<string, string>)
        if (fromMap) return fromMap
      }
      return rawKey
    })()

    const label = String(resolvedLabel).trim()
    if (!label) {
      keys.push(emptyKey)
      continue
    }

    // Prefer deterministic option ordering for selects.
    if (field && (field.type === 'single_select' || field.type === 'multi_select')) {
      const idx = selectSortIndex(field, label)
      keys.push({
        key: rawKey,
        label,
        sortKey: idx ?? label.toLowerCase(),
        isEmpty: false,
      })
      continue
    }

    if (field && (field.type === 'number' || field.type === 'currency' || field.type === 'percent')) {
      const n = typeof v === 'number' ? v : Number(String(v))
      keys.push({
        key: rawKey,
        label,
        sortKey: Number.isFinite(n) ? n : label.toLowerCase(),
        isEmpty: false,
      })
      continue
    }

    if (field && field.type === 'checkbox') {
      const b = !!v
      keys.push({
        key: b ? 'true' : 'false',
        label: b ? 'Checked' : 'Unchecked',
        sortKey: b ? 1 : 0,
        isEmpty: false,
      })
      continue
    }

    keys.push({ key: rawKey, label, sortKey: label.toLowerCase(), isEmpty: false })
  }

  if (keys.length === 0) return [emptyKey]

  // De-dupe while preserving stable sort order.
  const seen = new Set<string>()
  const deduped: GroupKey[] = []
  for (const k of keys) {
    const id = `${k.key}::${k.sortKey}`
    if (seen.has(id)) continue
    seen.add(id)
    deduped.push(k)
  }
  return deduped
}

function compareGroupKeys(a: GroupKey, b: GroupKey): number {
  if (a.sortKey === b.sortKey) return a.label.localeCompare(b.label)
  const an = typeof a.sortKey === 'number'
  const bn = typeof b.sortKey === 'number'
  if (an && bn) return (a.sortKey as number) - (b.sortKey as number)
  return String(a.sortKey).localeCompare(String(b.sortKey))
}

function buildNodesAtLevel<TItem extends Record<string, any>>(
  ctx: GroupContext,
  items: TItem[],
  rules: GroupRule[],
  ruleIndex: number,
  pathParts: Array<{ ruleIndex: number; key: string }>
): GroupedNode<TItem>[] {
  if (ruleIndex >= rules.length) {
    return []
  }

  // Normalize the rule to ensure field name matches data structure
  // Rules should already be normalized at the top level, but we normalize again
  // to ensure we're using the correct field name for data access
  const originalRule = rules[ruleIndex]
  if (!originalRule) {
    console.warn(`[GroupTree] Missing rule at index ${ruleIndex}`, { ruleIndex, rulesLength: rules.length })
    return []
  }
  
  const rule = normalizeGroupRuleFieldName(ctx, originalRule)
  const field = resolveField(ctx, rule.field)

  // If field cannot be resolved, skip this grouping level
  if (!field && rule.type === 'field') {
    console.warn(`[GroupTree] Cannot resolve field "${rule.field}" for grouping rule at index ${ruleIndex}. Available fields:`, Array.from(ctx.fieldByName.keys()))
    return []
  }
  
  // Ensure we have a valid field name to access data
  if (!rule.field) {
    console.warn(`[GroupTree] Rule at index ${ruleIndex} has no field name`, { rule })
    return []
  }
  
  // For nested groups, ensure we have a valid field name (not an ID) to access data
  // The normalizeGroupRuleFieldName should have converted IDs to names, but double-check
  const fieldNameForData = field ? field.name : rule.field
  
  // Debug logging for nested groups
  if (ruleIndex > 0 && items.length > 0) {
    console.log(`[GroupTree] Building level ${ruleIndex + 1} groups:`, {
      ruleIndex,
      field: rule.field,
      itemCount: items.length,
      sampleItem: items[0] ? Object.keys(items[0]) : [],
      sampleValue: items[0] ? (items[0] as any)?.[rule.field] : undefined,
    })
  }

  const buckets = new Map<string, { key: GroupKey; items: TItem[] }>()

  for (const item of items) {
    // Access the field value by name first, then by id (row may be keyed by either)
    const raw = (item as any)?.[fieldNameForData] ?? (field ? (item as any)?.[(field as any).id] : undefined)
    
    // Debug: Log if field is missing in data (only for nested levels to avoid spam)
    if (ruleIndex > 0 && raw === undefined && items.length > 0 && items.indexOf(item) === 0) {
      console.log(`[GroupTree] Field "${fieldNameForData}" (from rule field "${rule.field}") not found in item data at level ${ruleIndex + 1}. Available keys:`, Object.keys(item || {}))
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'41b24e'},body:JSON.stringify({sessionId:'41b24e',location:'groupTree.ts:fieldNotFound',message:'Field not found in item data',data:{fieldNameForData:fieldNameForData,ruleField:rule.field,ruleIndex,availableKeys:Object.keys(item||{})},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    }
    
    const groupKeys = getGroupKeysForValue(ctx, rule, field, raw)
    for (const gk of groupKeys) {
      const existing = buckets.get(gk.key)
      if (existing) {
        // Ensure we're adding the item to the correct bucket
        existing.items.push(item)
      } else {
        // Create a new array for each bucket to avoid sharing references
        buckets.set(gk.key, { key: gk, items: [item] })
      }
    }
  }
  
  // Debug: Log bucket creation for nested levels
  if (ruleIndex > 0 && buckets.size > 0) {
    console.log(`[GroupTree] Created ${buckets.size} buckets at level ${ruleIndex + 1}:`, Array.from(buckets.keys()))
  }

  const entries = Array.from(buckets.values()).sort((a, b) => compareGroupKeys(a.key, b.key))

  return entries.map(({ key, items: bucketItems }) => {
    const nextParts = [...pathParts, { ruleIndex, key: key.key }]
    const pathKey = joinPath(nextParts)
    // Recursively build children using the same rules array (already normalized at top level)
    // Pass bucketItems which contains only items that belong to this specific group
    const children = buildNodesAtLevel(ctx, bucketItems, rules, ruleIndex + 1, nextParts)
    const isLeafLevel = ruleIndex === rules.length - 1
    
    // Calculate size: if this is a leaf, use bucketItems.length
    // If it has children, the size should still be bucketItems.length (total items in this group)
    // The children will show the breakdown, but the parent size is the total
    const size = bucketItems.length
    
    const node: GroupedNode<TItem> = {
      type: 'group',
      ruleIndex,
      rule,
      pathKey,
      key: key.key,
      label: key.label,
      sortKey: key.sortKey,
      size,
      children,
      items: isLeafLevel ? bucketItems : undefined,
    }
    return node
  })
}

/**
 * Build a nested grouped tree with stable ordering and stable path keys.
 *
 * - **Stable ordering**: groups are ordered deterministically by field-aware sort keys.
 * - **No data loss**: items always appear in the output (some fields may duplicate items when grouping by arrays).
 * - **No jumpy re-renders**: path keys are stable across renders for the same data/rules.
 */
export function buildGroupTree<TItem extends Record<string, any>>(
  items: TItem[],
  fields: TableField[],
  rules: GroupRule[],
  options?: GroupTreeOptions
): { rules: GroupRule[]; rootGroups: GroupedNode<TItem>[] } {
  const ctx = buildContext(fields, options)
  const safeRules = Array.isArray(rules) ? rules.filter(Boolean) : []
  if (safeRules.length === 0) return { rules: [], rootGroups: [] }

  const normalizedRules = safeRules.map((r) => normalizeGroupRuleFieldName(ctx, r))
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'41b24e'},body:JSON.stringify({sessionId:'41b24e',location:'groupTree.ts:buildGroupTree',message:'buildGroupTree called',data:{ruleCount:normalizedRules.length,itemCount:items.length,availableFields:Array.from(ctx.fieldByName.keys())},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  // Debug logging for nested groups
  if (normalizedRules.length > 1) {
    console.log('[GroupTree] Building nested groups:', {
      ruleCount: normalizedRules.length,
      rules: normalizedRules.map(r => ({ type: r.type, field: r.field })),
      itemCount: items.length,
      availableFields: Array.from(ctx.fieldByName.keys()),
    })
  }
  
  const rootGroups = buildNodesAtLevel(ctx, items, normalizedRules, 0, [])
  
  // Debug: Check if second level groups were created
  if (normalizedRules.length > 1 && rootGroups.length > 0) {
    const firstGroup = rootGroups[0]
    console.log('[GroupTree] First level group created:', {
      label: firstGroup.label,
      size: firstGroup.size,
      hasChildren: Array.isArray(firstGroup.children) && firstGroup.children.length > 0,
      childrenCount: firstGroup.children?.length || 0,
      hasItems: Array.isArray(firstGroup.items) && firstGroup.items.length > 0,
      itemsCount: firstGroup.items?.length || 0,
    })
    if (firstGroup.children && firstGroup.children.length > 0) {
      console.log('[GroupTree] Second level groups:', firstGroup.children.map(c => ({
        label: c.label,
        size: c.size,
        hasItems: Array.isArray(c.items) && c.items.length > 0,
        itemsCount: c.items?.length || 0,
      })))
    }
  }
  
  return { rules: normalizedRules, rootGroups }
}

export function flattenGroupTree<TItem extends Record<string, any>>(
  rootGroups: GroupedNode<TItem>[],
  collapsed: Set<string>
): FlattenedGroupItem<TItem>[] {
  const out: FlattenedGroupItem<TItem>[] = []

  const walk = (node: GroupedNode<TItem>, level: number) => {
    out.push({ type: 'group', node, level })
    if (collapsed.has(node.pathKey)) return

    // Check if node has children (nested groups)
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    if (hasChildren) {
      // Process all children recursively
      for (const child of node.children) {
        walk(child, level + 1)
      }
      return
    }

    // If no children, this is a leaf node - process items
    const items = Array.isArray(node.items) ? node.items : []
    for (const item of items) {
      out.push({ type: 'item', item, level: level + 1, groupPathKey: node.pathKey })
    }
  }

  for (const g of rootGroups) walk(g, 0)
  return out
}

