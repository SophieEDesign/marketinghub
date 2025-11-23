"use client";

import { useState } from "react";
import { Filter as FilterIcon, ArrowUpDown, Settings, Trash2 } from "lucide-react";
import { Field } from "@/lib/fields";
import { Filter, Sort } from "@/lib/types/filters";
import ViewFilterPanel from "./ViewFilterPanel";
import ViewSortPanel from "./ViewSortPanel";
import FilterBadges from "../filters/FilterBadges";
import ViewSettingsDrawer from "../view-settings/ViewSettingsDrawer";
import ViewMenu from "./ViewMenu";
import { usePermissions } from "@/lib/hooks/usePermissions";

interface ViewSettings {
  visible_fields?: string[]; // Legacy - use hidden_columns instead
  field_order?: string[]; // Legacy - use column_order instead
  hidden_columns?: string[];
  column_order?: string[];
  column_widths?: Record<string, number>;
  groupings?: Array<{ name: string; fields: string[] }>;
  kanban_group_field?: string;
  calendar_date_field?: string;
  timeline_date_field?: string;
  row_height?: "compact" | "medium" | "tall";
  card_fields?: string[];
}

interface ViewHeaderProps {
  tableId: string;
  viewId: string;
  fields: Field[];
  filters: Filter[];
  sort: Sort[];
  onFiltersChange: (filters: Filter[]) => void;
  onSortChange: (sort: Sort[]) => void;
  onRemoveFilter: (filterId: string) => void;
  viewSettings?: ViewSettings;
  onViewSettingsUpdate?: (updates: ViewSettings) => Promise<void>;
  selectedRowCount?: number;
  onBulkDelete?: () => void;
  // ViewMenu props
  currentView?: any; // ViewConfig
  views?: any[]; // ViewConfig[]
  onRenameView?: (newName: string) => Promise<void>;
  onDuplicateView?: () => Promise<void>;
  onDeleteView?: () => Promise<void>;
  onSetDefaultView?: () => Promise<void>;
  onChangeViewType?: (viewType: "grid" | "kanban" | "calendar" | "timeline" | "cards") => Promise<void>;
  onResetLayout?: () => Promise<void>;
  onCreateView?: () => Promise<void>;
}

export default function ViewHeader({
  tableId,
  viewId,
  fields,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  onRemoveFilter,
  viewSettings,
  onViewSettingsUpdate,
  selectedRowCount = 0,
  onBulkDelete,
  currentView,
  views = [],
  onRenameView,
  onDuplicateView,
  onDeleteView,
  onSetDefaultView,
  onChangeViewType,
  onResetLayout,
  onCreateView,
}: ViewHeaderProps) {
  const permissions = usePermissions();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  const handleFiltersChange = async (newFilters: Filter[]) => {
    await onFiltersChange(newFilters);
    setShowFilterPanel(false);
  };

  const handleSortChange = async (newSort: Sort[]) => {
    await onSortChange(newSort);
    setShowSortPanel(false);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 mb-4">
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <ViewMenu
            view={currentView || null}
            views={views}
            onRename={permissions.canModifyViews ? (onRenameView || (async () => {})) : undefined}
            onDuplicate={permissions.canModifyViews ? (onDuplicateView || (async () => {})) : undefined}
            onDelete={permissions.canModifyViews ? (onDeleteView || (async () => {})) : undefined}
            onSetDefault={permissions.canModifyViews ? (onSetDefaultView || (async () => {})) : undefined}
            onChangeViewType={permissions.canModifyViews ? (onChangeViewType || (async () => {})) : undefined}
            onResetLayout={permissions.canModifyViews ? (onResetLayout || (async () => {})) : undefined}
            onCreateView={permissions.canModifyViews ? (onCreateView || (async () => {})) : undefined}
          />
          {filters.length > 0 && (
            <FilterBadges
              filters={filters}
              fields={fields}
              onRemoveFilter={onRemoveFilter}
            />
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {selectedRowCount > 0 && onBulkDelete && permissions.canDelete && (
            <button
              onClick={onBulkDelete}
              className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 md:py-2 touch-manipulation bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
            >
              <Trash2 className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">
                Delete {selectedRowCount} {selectedRowCount === 1 ? "record" : "records"}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowFilterPanel(true)}
            className={`btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 md:py-2 touch-manipulation ${filters.length > 0 ? "bg-brand-red/10 text-brand-red border-brand-red" : ""}`}
          >
            <FilterIcon className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
            <span className="text-sm md:text-base">
              Filters {filters.length > 0 && `(${filters.length})`}
            </span>
          </button>
          <button
            onClick={() => setShowSortPanel(true)}
            className={`btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 md:py-2 touch-manipulation ${sort.length > 0 ? "bg-brand-red/10 text-brand-red border-brand-red" : ""}`}
          >
            <ArrowUpDown className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
            <span className="text-sm md:text-base">
              Sort {sort.length > 0 && `(${sort.length})`}
            </span>
          </button>
          {permissions.canModifyViews && (
            <button
              onClick={() => setShowSettingsDrawer(true)}
              className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 md:py-2 touch-manipulation"
              title="View Settings"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
              <span className="text-sm md:text-base hidden sm:inline">Settings</span>
            </button>
          )}
        </div>
      </div>

      {onViewSettingsUpdate && (
        <ViewSettingsDrawer
          open={showSettingsDrawer}
          onClose={() => setShowSettingsDrawer(false)}
          tableId={tableId}
          viewId={viewId}
          fields={fields}
          settings={viewSettings || {}}
          onUpdate={onViewSettingsUpdate}
        />
      )}

      <ViewFilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        fields={fields}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <ViewSortPanel
        open={showSortPanel}
        onClose={() => setShowSortPanel(false)}
        fields={fields}
        sort={sort}
        onSortChange={handleSortChange}
      />
    </>
  );
}

