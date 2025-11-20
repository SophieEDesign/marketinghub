"use client";

import { useState } from "react";
import { Filter as FilterIcon, ArrowUpDown, Settings } from "lucide-react";
import { Field } from "@/lib/fields";
import { Filter, Sort } from "@/lib/types/filters";
import FilterPanel from "../filters/FilterPanel";
import SortPanel from "../sorting/SortPanel";
import FilterBadges from "../filters/FilterBadges";
import ViewSettingsDrawer from "../view-settings/ViewSettingsDrawer";

interface ViewSettings {
  visible_fields?: string[];
  field_order?: string[];
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
}: ViewHeaderProps) {
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
        <div className="flex-1 min-w-0">
          <FilterBadges
            filters={filters}
            fields={fields}
            onRemoveFilter={onRemoveFilter}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
          <button
            onClick={() => setShowSettingsDrawer(true)}
            className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 md:py-2 touch-manipulation"
            title="View Settings"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
            <span className="text-sm md:text-base hidden sm:inline">Settings</span>
          </button>
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

      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        fields={fields}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <SortPanel
        open={showSortPanel}
        onClose={() => setShowSortPanel(false)}
        fields={fields}
        sort={sort}
        onSortChange={handleSortChange}
      />
    </>
  );
}

