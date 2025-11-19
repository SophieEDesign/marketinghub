"use client";

import { useState } from "react";
import { Filter as FilterIcon, ArrowUpDown } from "lucide-react";
import { Field } from "@/lib/fields";
import { Filter, Sort } from "@/lib/types/filters";
import FilterPanel from "../filters/FilterPanel";
import SortPanel from "../sorting/SortPanel";
import FilterBadges from "../filters/FilterBadges";

interface ViewHeaderProps {
  fields: Field[];
  filters: Filter[];
  sort: Sort[];
  onFiltersChange: (filters: Filter[]) => void;
  onSortChange: (sort: Sort[]) => void;
  onRemoveFilter: (filterId: string) => void;
}

export default function ViewHeader({
  fields,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  onRemoveFilter,
}: ViewHeaderProps) {
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);

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
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <FilterBadges
            filters={filters}
            fields={fields}
            onRemoveFilter={onRemoveFilter}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilterPanel(true)}
            className={`btn-secondary flex items-center gap-2 ${filters.length > 0 ? "bg-brand-red/10 text-brand-red border-brand-red" : ""}`}
          >
            <FilterIcon className="w-4 h-4" />
            Filters {filters.length > 0 && `(${filters.length})`}
          </button>
          <button
            onClick={() => setShowSortPanel(true)}
            className={`btn-secondary flex items-center gap-2 ${sort.length > 0 ? "bg-brand-red/10 text-brand-red border-brand-red" : ""}`}
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort {sort.length > 0 && `(${sort.length})`}
          </button>
        </div>
      </div>

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

