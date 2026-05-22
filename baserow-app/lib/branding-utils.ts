/** Readable default for the fixed white Marketing Hub sidebar */
export const DEFAULT_LIGHT_SIDEBAR_TEXT_COLOR = '#4b5563'

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function luminanceFromHex(hex: string): number | null {
  const raw = hex.replace(/^#/, '').trim()
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    return relativeLuminance(r, g, b)
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16)
    const g = parseInt(raw.slice(2, 4), 16)
    const b = parseInt(raw.slice(4, 6), 16)
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    return relativeLuminance(r, g, b)
  }
  return null
}

function luminanceFromCssColor(color: string): number | null {
  const trimmed = color.trim().toLowerCase()
  if (trimmed === 'white') return 1
  if (trimmed.startsWith('#')) return luminanceFromHex(trimmed)
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) {
    return relativeLuminance(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]))
  }
  return null
}

/** Ensures sidebar link text stays readable on the white sidebar (ignores light branding values). */
export function normalizeSidebarTextColor(color: string | null | undefined): string {
  if (!color) return DEFAULT_LIGHT_SIDEBAR_TEXT_COLOR
  const luminance = luminanceFromCssColor(color)
  if (luminance == null) return color
  return luminance > 0.55 ? DEFAULT_LIGHT_SIDEBAR_TEXT_COLOR : color
}

export interface WorkspaceSettings {
  id: string
  workspace_id: string | null
  brand_name: string | null
  logo_url: string | null
  primary_color: string | null
  accent_color: string | null
  sidebar_color: string | null
  sidebar_text_color: string | null
  default_interface_id?: string | null
  created_at: string
  updated_at?: string
}
