/** Curated HSL colors for chart `color_scheme` (light / dark). */

export const DEFAULT_CHART_COLORS_LIGHT = [
  "hsl(262 83% 58%)",
  "hsl(173 58% 42%)",
  "hsl(38 92% 50%)",
  "hsl(350 75% 52%)",
  "hsl(270 65% 55%)",
  "hsl(199 89% 48%)",
] as const

export const SCHEME_PALETTES: Record<
  string,
  { light: string[]; dark: string[] }
> = {
  blue: {
    light: [
      "hsl(221 83% 53%)",
      "hsl(212 95% 68%)",
      "hsl(199 89% 48%)",
      "hsl(204 94% 38%)",
      "hsl(217 91% 60%)",
      "hsl(189 94% 43%)",
    ],
    dark: [
      "hsl(217 91% 72%)",
      "hsl(204 94% 78%)",
      "hsl(199 85% 62%)",
      "hsl(212 95% 75%)",
      "hsl(221 83% 70%)",
      "hsl(189 80% 55%)",
    ],
  },
  green: {
    light: [
      "hsl(142 71% 45%)",
      "hsl(160 84% 39%)",
      "hsl(134 61% 41%)",
      "hsl(152 69% 36%)",
      "hsl(172 66% 40%)",
      "hsl(88 50% 45%)",
    ],
    dark: [
      "hsl(142 70% 55%)",
      "hsl(160 84% 50%)",
      "hsl(134 61% 52%)",
      "hsl(152 69% 48%)",
      "hsl(172 66% 52%)",
      "hsl(88 50% 58%)",
    ],
  },
  purple: {
    light: [
      "hsl(271 81% 56%)",
      "hsl(293 69% 49%)",
      "hsl(250 65% 55%)",
      "hsl(280 70% 50%)",
      "hsl(262 83% 58%)",
      "hsl(305 75% 48%)",
    ],
    dark: [
      "hsl(271 81% 70%)",
      "hsl(293 69% 65%)",
      "hsl(250 75% 72%)",
      "hsl(280 70% 68%)",
      "hsl(262 83% 74%)",
      "hsl(305 75% 62%)",
    ],
  },
  orange: {
    light: [
      "hsl(24 95% 53%)",
      "hsl(32 95% 50%)",
      "hsl(38 92% 50%)",
      "hsl(20 90% 48%)",
      "hsl(43 96% 56%)",
      "hsl(16 85% 50%)",
    ],
    dark: [
      "hsl(24 95% 62%)",
      "hsl(32 95% 58%)",
      "hsl(38 92% 58%)",
      "hsl(20 90% 58%)",
      "hsl(43 96% 64%)",
      "hsl(16 85% 60%)",
    ],
  },
  red: {
    light: [
      "hsl(0 84% 60%)",
      "hsl(350 75% 52%)",
      "hsl(340 82% 52%)",
      "hsl(10 78% 54%)",
      "hsl(355 78% 56%)",
      "hsl(330 70% 50%)",
    ],
    dark: [
      "hsl(0 84% 68%)",
      "hsl(350 80% 65%)",
      "hsl(340 82% 65%)",
      "hsl(10 78% 66%)",
      "hsl(355 78% 68%)",
      "hsl(330 70% 62%)",
    ],
  },
}

export function readCssChartVars(): string[] {
  if (typeof document === "undefined") return [...DEFAULT_CHART_COLORS_LIGHT]
  const cs = getComputedStyle(document.documentElement)
  const out: string[] = []
  for (let i = 1; i <= 6; i++) {
    const v = cs.getPropertyValue(`--chart-${i}`).trim()
    if (v) out.push(`hsl(${v})`)
  }
  return out.length === 6 ? out : [...DEFAULT_CHART_COLORS_LIGHT]
}

export function getLegendLayout(position: string | undefined) {
  const pos = position || "bottom"
  if (pos === "top") {
    return {
      layout: "horizontal" as const,
      verticalAlign: "top" as const,
      align: "center" as const,
    }
  }
  if (pos === "left") {
    return {
      layout: "vertical" as const,
      verticalAlign: "middle" as const,
      align: "left" as const,
    }
  }
  if (pos === "right") {
    return {
      layout: "vertical" as const,
      verticalAlign: "middle" as const,
      align: "right" as const,
    }
  }
  return {
    layout: "horizontal" as const,
    verticalAlign: "bottom" as const,
    align: "center" as const,
  }
}
