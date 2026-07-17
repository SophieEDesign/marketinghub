/** Lightweight signature for block config/layout compare (avoids JSON.stringify on hot paths). */
export function blockLayoutSignature(block: {
  id: string
  x?: number
  y?: number
  w?: number
  h?: number
  order_index?: number
  updated_at?: string
  config?: Record<string, unknown>
}): string {
  const cfg = block.config ?? {}
  const cfgKeys = Object.keys(cfg).sort().join(",")
  return [
    block.id,
    block.x ?? 0,
    block.y ?? 0,
    block.w ?? 0,
    block.h ?? 0,
    block.order_index ?? 0,
    block.updated_at ?? "",
    cfgKeys,
    typeof cfg.version === "string" ? cfg.version : "",
  ].join("|")
}

export function blocksArraySignature(blocks: Array<{ id: string; x?: number; y?: number; w?: number; h?: number; order_index?: number; updated_at?: string; config?: Record<string, unknown> }>): string {
  return blocks.map(blockLayoutSignature).join(";")
}
