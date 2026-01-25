"use client"

import type { ReactNode } from "react"
import type { PageBlock, BlockConfig, BlockType } from "@/lib/interface/types"
import type { Table, View, TableField } from "@/types/database"

import KPIDataSettings from "./KPIDataSettings"
import KPIAppearanceSettings from "./KPIAppearanceSettings"
import ChartDataSettings from "./ChartDataSettings"
import ChartAppearanceSettings from "./ChartAppearanceSettings"
import TextDataSettings from "./TextDataSettings"
import TextAppearanceSettings from "./TextAppearanceSettings"
import ActionDataSettings from "./ActionDataSettings"
import ActionAppearanceSettings from "./ActionAppearanceSettings"
import LinkPreviewDataSettings from "./LinkPreviewDataSettings"
import LinkPreviewAppearanceSettings from "./LinkPreviewAppearanceSettings"
import GridDataSettings from "./GridDataSettings"
import GridAppearanceSettings from "./GridAppearanceSettings"
import ListDataSettings from "./ListDataSettings"
import MultiSourceDataSettings from "./MultiSourceDataSettings"
import FormDataSettings from "./FormDataSettings"
import FormAppearanceSettings from "./FormAppearanceSettings"
import RecordDataSettings from "./RecordDataSettings"
import RecordAppearanceSettings from "./RecordAppearanceSettings"
import ImageDataSettings from "./ImageDataSettings"
import ImageAppearanceSettings from "./ImageAppearanceSettings"
import DividerAppearanceSettings from "./DividerAppearanceSettings"
import FilterBlockSettings from "./FilterBlockSettings"
import FieldDataSettings from "./FieldDataSettings"
import FieldAppearanceSettings from "./FieldAppearanceSettings"
import ButtonDataSettings from "./ButtonDataSettings"
import ButtonAppearanceSettings from "./ButtonAppearanceSettings"
import CommonAppearanceSettings from "./CommonAppearanceSettings"

export type DataSettingsCtx = {
  config: BlockConfig
  tables: Table[]
  views: View[]
  fields: TableField[]
  onUpdate: (updates: Partial<BlockConfig>) => void
  onTableChange: (tableId: string) => Promise<void>
  pageTableId?: string | null
  allBlocks?: PageBlock[]
}

export type AppearanceSettingsCtx = {
  blockType: BlockType | undefined
  config: BlockConfig
  fields: TableField[]
  onUpdateAppearance: (updates: Partial<BlockConfig["appearance"]>) => void
  onUpdateConfig: (updates: Partial<BlockConfig>) => void
}

type DataRenderer = (ctx: DataSettingsCtx) => ReactNode
type AppearanceRenderer = (ctx: AppearanceSettingsCtx) => ReactNode

/**
 * Central registry for block settings rendering.
 *
 * Goal: keep `SettingsPanel.tsx` thin and stable; adding/updating block settings
 * should only require changes here (plus the settings component itself).
 */
const DATA_SETTINGS_RENDERERS: Partial<Record<BlockType, DataRenderer>> = {
  kpi: (ctx) => <KPIDataSettings {...ctx} />,
  chart: (ctx) => <ChartDataSettings {...ctx} />,
  text: (ctx) => <TextDataSettings {...ctx} />,
  action: (ctx) => <ActionDataSettings {...ctx} />,
  link_preview: (ctx) => <LinkPreviewDataSettings {...ctx} />,
  grid: (ctx) => <GridDataSettings {...ctx} />,
  form: (ctx) => <FormDataSettings {...ctx} />,
  record: (ctx) => <RecordDataSettings {...ctx} />,
  image: (ctx) => <ImageDataSettings {...ctx} />,
  filter: (ctx) => (
    <FilterBlockSettings
      {...ctx}
      allBlocks={ctx.allBlocks || []}
      pageTableId={ctx.pageTableId ?? null}
    />
  ),
  field: (ctx) => <FieldDataSettings {...ctx} pageTableId={ctx.pageTableId ?? null} />,
  number: (ctx) => <FieldDataSettings {...ctx} pageTableId={ctx.pageTableId ?? null} />,
  button: (ctx) => <ButtonDataSettings {...ctx} />,
  list: (ctx) => <ListDataSettings {...ctx} />,
  multi_calendar: (ctx) => <MultiSourceDataSettings {...ctx} />,
  multi_timeline: (ctx) => <MultiSourceDataSettings {...ctx} />,
  calendar: (ctx) => <GridDataSettings {...ctx} />,
  kanban: (ctx) => <GridDataSettings {...ctx} />,
  timeline: (ctx) => <GridDataSettings {...ctx} />,
  gallery: (ctx) => <GridDataSettings {...ctx} />,
}

const APPEARANCE_SETTINGS_RENDERERS: Partial<Record<BlockType, AppearanceRenderer>> = {
  kpi: (ctx) => (
    <>
      <KPIAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  chart: (ctx) => (
    <>
      <ChartAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  text: (ctx) => (
    <>
      <TextAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  action: (ctx) => (
    <>
      <ActionAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        onConfigUpdate={ctx.onUpdateConfig}
      />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  link_preview: (ctx) => (
    <>
      <LinkPreviewAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  form: (ctx) => (
    <>
      <FormAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  record: (ctx) => (
    <>
      <RecordAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  image: (ctx) => (
    <>
      <ImageAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  divider: (ctx) => (
    <>
      <DividerAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  grid: (ctx) => (
    <>
      <GridAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} fields={ctx.fields} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  field: (ctx) => (
    <>
      <FieldAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateConfig} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  number: (ctx) => (
    <>
      <FieldAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateConfig} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  button: (ctx) => (
    <>
      <ButtonAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  list: (ctx) => (
    <>
      <GridAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} fields={ctx.fields} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  calendar: (ctx) => (
    <>
      <GridAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} fields={ctx.fields} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  multi_calendar: (ctx) => (
    <>
      <GridAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} fields={ctx.fields} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  kanban: (ctx) => (
    <>
      <GridAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} fields={ctx.fields} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  timeline: (ctx) => (
    <>
      <GridAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} fields={ctx.fields} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  multi_timeline: (ctx) => (
    <>
      <GridAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} fields={ctx.fields} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
  gallery: (ctx) => (
    <>
      <GridAppearanceSettings config={ctx.config} onUpdate={ctx.onUpdateAppearance} fields={ctx.fields} />
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    </>
  ),
}

export function renderBlockDataSettings(
  blockType: BlockType | undefined,
  ctx: DataSettingsCtx
): ReactNode {
  if (!blockType) return null
  return DATA_SETTINGS_RENDERERS[blockType]?.(ctx) ?? null
}

export function renderBlockAppearanceSettings(
  blockType: BlockType | undefined,
  ctx: AppearanceSettingsCtx
): ReactNode {
  if (!blockType) return null

  // Default: always show CommonAppearanceSettings even if block has no specific appearance settings.
  return (
    APPEARANCE_SETTINGS_RENDERERS[blockType]?.(ctx) ?? (
      <CommonAppearanceSettings
        config={ctx.config}
        onUpdate={ctx.onUpdateAppearance}
        blockType={ctx.blockType}
        fields={ctx.fields}
      />
    )
  )
}

