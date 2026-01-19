import type { TableField } from '@/types/fields'
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
    const label = safeString(v).trim()
    if (!label) {
      keys.push(emptyKey)
      continue
    }

    // Prefer deterministic option ordering for selects.
    if (field && (field.type === 'single_select' || field.type === 'multi_select')) {
      const idx = selectSortIndex(field, label)
      keys.push({
        key: label,
        label,
        sortKey: idx ?? label.toLowerCase(),
        isEmpty: false,
      })
      continue
    }

    if (field && (field.type === 'number' || field.type === 'currency' || field.type === 'percent')) {
      const n = typeof v === 'number' ? v : Number(String(v))
      keys.push({
        key: label,
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

    keys.push({ key: label, label, sortKey: label.toLowerCase(), isEmpty: false })
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

  const rule = normalizeGroupRuleFieldName(ctx, rules[ruleIndex])
  const field = resolveField(ctx, rule.field)

  const buckets = new Map<string, { key: GroupKey; items: TItem[] }>()

  for (const item of items) {
    const raw = (item as any)?.[rule.field]
    const groupKeys = getGroupKeysForValue(ctx, rule, field, raw)
    for (const gk of groupKeys) {
      const existing = buckets.get(gk.key)
      if (existing) {
        existing.items.push(item)
      } else {
        buckets.set(gk.key, { key: gk, items: [item] })
      }
    }
  }

  const entries = Array.from(buckets.values()).sort((a, b) => compareGroupKeys(a.key, b.key))

  return entries.map(({ key, items: bucketItems }) => {
    const nextParts = [...pathParts, { ruleIndex, key: key.key }]
    const pathKey = joinPath(nextParts)
    const children = buildNodesAtLevel(ctx, bucketItems, rules, ruleIndex + 1, nextParts)
    const isLeafLevel = ruleIndex === rules.length - 1
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
  const rootGroups = buildNodesAtLevel(ctx, items, normalizedRules, 0, [])
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

    if (Array.isArray(node.children) && node.children.length > 0) {
      for (const child of node.children) walk(child, level + 1)
      return
    }

    const items = Array.isArray(node.items) ? node.items : []
    for (const item of items) out.push({ type: 'item', item, level: level + 1, groupPathKey: node.pathKey })
  }

  for (const g of rootGroups) walk(g, 0)
  return out
}

