import { createServerSupabaseClient } from './supabase'

export interface GridViewSettings {
  id: string
  view_id: string
  group_by_field: string | null
  column_widths: Record<string, number>
  column_order: string[]
  column_wrap_text: Record<string, boolean>
  row_height: 'short' | 'medium' | 'tall'
  frozen_columns: number
  created_at: string
  updated_at: string
}

/**
 * Load grid view settings for a specific view
 */
export async function loadGridViewSettings(viewId: string): Promise<GridViewSettings | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('grid_view_settings')
    .select('*')
    .eq('view_id', viewId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No settings found, return null
      return null
    }
    throw error
  }

  return data as GridViewSettings
}

/**
 * Create or update grid view settings
 */
export async function saveGridViewSettings(
  viewId: string,
  settings: Partial<Omit<GridViewSettings, 'id' | 'view_id' | 'created_at' | 'updated_at'>>
): Promise<GridViewSettings> {
  const supabase = await createServerSupabaseClient()
  
  // Check if settings already exist
  const existing = await loadGridViewSettings(viewId)
  
  if (existing) {
    // Update existing settings
    const { data, error } = await supabase
      .from('grid_view_settings')
      .update(settings)
      .eq('view_id', viewId)
      .select()
      .single()

    if (error) throw error
    return data as GridViewSettings
  } else {
    // Create new settings
    const { data, error } = await supabase
      .from('grid_view_settings')
      .insert([
        {
          view_id: viewId,
          group_by_field: settings.group_by_field ?? null,
          column_widths: settings.column_widths ?? {},
          column_order: settings.column_order ?? [],
          column_wrap_text: settings.column_wrap_text ?? {},
          row_height: settings.row_height ?? 'medium',
          frozen_columns: settings.frozen_columns ?? 0,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data as GridViewSettings
  }
}

/**
 * Update group by field for a grid view
 */
export async function updateGroupBy(viewId: string, fieldName: string | null): Promise<void> {
  await saveGridViewSettings(viewId, { group_by_field: fieldName })
}

/**
 * Update column widths for a grid view
 */
export async function updateColumnWidths(
  viewId: string,
  widths: Record<string, number>
): Promise<void> {
  await saveGridViewSettings(viewId, { column_widths: widths })
}

/**
 * Update column order for a grid view
 */
export async function updateColumnOrder(viewId: string, order: string[]): Promise<void> {
  await saveGridViewSettings(viewId, { column_order: order })
}

/**
 * Update column wrap text settings for a grid view
 */
export async function updateColumnWrapText(
  viewId: string,
  wrapText: Record<string, boolean>
): Promise<void> {
  await saveGridViewSettings(viewId, { column_wrap_text: wrapText })
}

/**
 * Update row height for a grid view
 */
export async function updateRowHeight(
  viewId: string,
  height: 'short' | 'medium' | 'tall'
): Promise<void> {
  await saveGridViewSettings(viewId, { row_height: height })
}

