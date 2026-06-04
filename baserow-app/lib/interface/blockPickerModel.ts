import { BLOCK_REGISTRY, getAllBlockTypes } from "@/lib/interface/registry"
import type { BlockType } from "@/lib/interface/types"

export type BlockCategoryId = "data_views" | "metrics" | "record" | "content" | "layout"

export const BLOCK_CATEGORY_ORDER: BlockCategoryId[] = [
  "data_views",
  "metrics",
  "record",
  "content",
  "layout",
]

export const BLOCK_CATEGORY_LABELS: Record<BlockCategoryId, string> = {
  data_views: "Data views",
  metrics: "Metrics & filters",
  record: "Record",
  content: "Content",
  layout: "Layout",
}

const BLOCK_TYPE_CATEGORY: Record<BlockType, BlockCategoryId> = {
  grid: "data_views",
  form: "data_views",
  calendar: "data_views",
  multi_calendar: "data_views",
  kanban: "data_views",
  timeline: "data_views",
  multi_timeline: "data_views",
  list: "data_views",
  chart: "metrics",
  kpi: "metrics",
  kpi_summary: "metrics",
  filter: "metrics",
  record: "record",
  record_context: "record",
  field: "record",
  field_section: "record",
  number: "record",
  text: "content",
  html: "content",
  image: "content",
  gallery: "content",
  link_preview: "content",
  content_theme: "content",
  content_timeline: "content",
  internal_resource_hub: "content",
  upcoming_summary: "content",
  things_to_do: "content",
  event_calendar: "content",
  social_media_calendar: "content",
  campaigns_overview: "content",
  members_welcome: "content",
  button: "content",
  action: "content",
  divider: "layout",
  horizontal_grouped: "layout",
}

export function getCategoryForBlockType(type: BlockType): BlockCategoryId {
  return BLOCK_TYPE_CATEGORY[type] ?? "content"
}

export function filterBlockTypesBySearch(search: string): BlockType[] {
  const q = search.trim().toLowerCase()
  const all = getAllBlockTypes()
  if (!q) return all

  return all.filter((type) => {
    const def = BLOCK_REGISTRY[type]
    const label = (def?.label || type).toLowerCase()
    const id = type.toLowerCase().replace(/_/g, " ")
    return label.includes(q) || id.includes(q) || type.toLowerCase().includes(q)
  })
}

export function groupBlockTypes(types: BlockType[]): Array<{ category: BlockCategoryId; types: BlockType[] }> {
  const byCat = new Map<BlockCategoryId, BlockType[]>()
  for (const c of BLOCK_CATEGORY_ORDER) {
    byCat.set(c, [])
  }
  for (const t of types) {
    const cat = getCategoryForBlockType(t)
    const list = byCat.get(cat) ?? byCat.get("content")!
    list.push(t)
  }
  return BLOCK_CATEGORY_ORDER.filter((c) => (byCat.get(c)?.length ?? 0) > 0).map((category) => ({
    category,
    types: byCat.get(category) ?? [],
  }))
}
