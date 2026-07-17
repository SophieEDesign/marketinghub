import type { TableField } from "@/types/fields"

/**
 * Primary field = the table's identifying field ("Name"/record label).
 *
 * Core rule:
 * - Use the first non-system, non-virtual field by position/order.
 * - Fall back to the first field if everything is system/virtual.
 */
export function getPrimaryField(fields: TableField[] | null | undefined): TableField | null {
  if (!fields || fields.length === 0) return null

  const sorted = [...fields].sort((a, b) => {
    const ap = Number.isFinite(a.position) ? a.position : 0
    const bp = Number.isFinite(b.position) ? b.position : 0
    if (ap !== bp) return ap - bp
    // `Number.isFinite(x)` is not a TS type guard, so also check `typeof` to keep `ao/bo` as `number`.
    const ao = typeof a.order_index === "number" && Number.isFinite(a.order_index) ? a.order_index : 0
    const bo = typeof b.order_index === "number" && Number.isFinite(b.order_index) ? b.order_index : 0
    if (ao !== bo) return ao - bo
    return String(a.name).localeCompare(String(b.name))
  })

  const isVirtual = (f: TableField) => f.type === "formula" || f.type === "lookup"
  const isSystem = (f: TableField) => Boolean((f.options as any)?.system)

  const candidate =
    sorted.find((f) => !isSystem(f) && !isVirtual(f)) ||
    sorted.find((f) => !isSystem(f)) ||
    sorted[0]

  return candidate || null
}

export function getPrimaryFieldName(fields: TableField[] | null | undefined): string | null {
  const f = getPrimaryField(fields)
  return f?.name || null
}

