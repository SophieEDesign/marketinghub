"use client"

import { useMemo, useState } from "react"
import {
  FolderOpen,
  Grid3X3,
  ImageIcon,
  LayoutGrid,
  List,
  Search,
  Upload,
} from "lucide-react"
import AssetCard from "@/components/interface/internal-staff-hub/AssetCard"
import AssetPreviewModal from "@/components/interface/internal-staff-hub/AssetPreviewModal"
import CategoryCard from "@/components/interface/internal-staff-hub/CategoryCard"
import QuickAccessPanel from "@/components/interface/internal-staff-hub/QuickAccessPanel"
import UploadCarousel from "@/components/interface/internal-staff-hub/UploadCarousel"
import { EditableDashboardRegion } from "@/components/interface/EditableDashboardRegion"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import DashboardPanel from "@/components/interface/primitives/DashboardPanel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useInternalStaffHubData } from "@/hooks/useInternalStaffHubData"
import {
  buildGeneralGalleryAsset,
  GENERAL_GALLERY_FOLDER,
  HUB_CATEGORIES,
  countByCategory,
  filterStaffHubAssets,
  getRecentUploads,
  resolveQuickAccessAssets,
  type HubCategoryId,
  type StaffHubAsset,
  type StaffHubFilters,
} from "@/lib/marketing/internal-staff-hub"
import { DASHBOARD_PAGE_GAP } from "@/lib/interface/spacing-tokens"
import { TEXT_LABEL, TEXT_META, TEXT_PAGE_TITLE } from "@/lib/interface/typography-tokens"
import { cn } from "@/lib/utils"

const FILTER_CONTROL = "h-8 text-xs border-border/40"

interface InternalStaffHubDashboardProps {
  canEdit?: boolean
}

export default function InternalStaffHubDashboard({
  canEdit = false,
}: InternalStaffHubDashboardProps) {
  const { openRecordModal } = useRecordModal()
  const { loading, error, tableIds, assets, filterOptions, reload } = useInternalStaffHubData()

  const [filters, setFilters] = useState<StaffHubFilters>({
    search: "",
    category: "all",
    type: "all",
    tag: "all",
  })
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [previewAsset, setPreviewAsset] = useState<StaffHubAsset | null>(null)

  const categoryCounts = useMemo(() => countByCategory(assets), [assets])
  const quickAccess = useMemo(() => resolveQuickAccessAssets(assets), [assets])
  const recent = useMemo(() => getRecentUploads(assets, 8), [assets])

  const filteredAssets = useMemo(
    () => filterStaffHubAssets(assets, filters),
    [assets, filters]
  )

  const openAsset = (asset: StaffHubAsset) => {
    if (asset.link?.openUrl) {
      window.open(asset.link.openUrl, "_blank", "noopener,noreferrer")
      return
    }
    if (!asset.id.startsWith("placeholder-") && tableIds) {
      openRecordModal({
        tableId: tableIds.resourcesTableId,
        recordId: asset.id,
        supabaseTableName: tableIds.resourcesSupabaseTable,
        onRecordUpdated: reload,
        onDeleted: reload,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" text="Loading creative hub…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col min-w-0 pb-4", DASHBOARD_PAGE_GAP)}>
      <header className="px-0.5">
        <h1 className={TEXT_PAGE_TITLE}>Internal Staff Hub</h1>
        <p className={cn(TEXT_META, "mt-1 max-w-2xl")}>
          Brand assets, presentations, graphics, templates and internal resources.
        </p>
      </header>

      <EditableDashboardRegion id="hero" label="Hero">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
          <HeroCard
            search={filters.search}
            onSearchChange={(v) => setFilters((f) => ({ ...f, search: v }))}
            canEdit={canEdit}
            onBrowseGallery={() => setPreviewAsset(buildGeneralGalleryAsset())}
            onUpload={() => {
              if (tableIds) {
                openRecordModal({
                  tableId: tableIds.resourcesTableId,
                  recordId: null,
                  supabaseTableName: tableIds.resourcesSupabaseTable,
                  onRecordUpdated: reload,
                })
              }
            }}
          />
          <QuickAccessCol quickAccess={quickAccess} onOpen={openAsset} />
        </div>
      </EditableDashboardRegion>

      <EditableDashboardRegion id="categories" label="Categories">
        <section>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className={TEXT_LABEL}>Browse by category</h2>
            {filters.category !== "all" ? (
              <button
                type="button"
                className="text-xs text-accent-link hover:underline"
                onClick={() => setFilters((f) => ({ ...f, category: "all" }))}
              >
                Clear filter
              </button>
            ) : null}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory -mx-0.5 px-0.5">
            {HUB_CATEGORIES.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                count={categoryCounts[cat.id] ?? 0}
                active={filters.category === cat.id}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    category: f.category === cat.id ? "all" : cat.id,
                  }))
                }
              />
            ))}
          </div>
        </section>
      </EditableDashboardRegion>

      {recent.length > 0 ? (
        <EditableDashboardRegion id="recent" label="Recent uploads">
          <DashboardPanel
            title="Recent uploads"
            subtitle="Latest additions to the library"
            density="compact"
            actions={
              <button
                type="button"
                className="text-xs font-medium text-accent-link hover:underline"
                onClick={() => setFilters((f) => ({ ...f, search: "" }))}
              >
                View all
              </button>
            }
            bodyClassName="px-3 pb-3 pt-0"
          >
            <UploadCarousel items={recent} onPreview={setPreviewAsset} />
          </DashboardPanel>
        </EditableDashboardRegion>
      ) : null}

      <EditableDashboardRegion id="all-assets" label="All assets">
        <DashboardPanel
          title="All assets"
          subtitle={`${filteredAssets.length} resource${filteredAssets.length === 1 ? "" : "s"}`}
          density="compact"
          bodyClassName="px-3 pb-4 pt-0"
        >
          <AssetsFilterBar
            filters={filters}
            setFilters={setFilters}
            filterOptions={filterOptions}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />

          {filteredAssets.length === 0 ? (
            <DashboardEmpty
              title="No assets found"
              description="Try adjusting your search or filters."
              className="mt-4"
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  variant="grid"
                  onPreview={setPreviewAsset}
                  onOpen={openAsset}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-4">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  variant="list"
                  onPreview={setPreviewAsset}
                  onOpen={openAsset}
                />
              ))}
            </div>
          )}
        </DashboardPanel>
      </EditableDashboardRegion>

      <AssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
    </div>
  )
}

function HeroCard({
  search,
  onSearchChange,
  canEdit,
  onBrowseGallery,
  onUpload,
}: {
  search: string
  onSearchChange: (v: string) => void
  canEdit: boolean
  onBrowseGallery: () => void
  onUpload: () => void
}) {
  return (
    <div
      className={cn(
        "lg:col-span-8 rounded-card-lg border border-border/40 overflow-hidden shadow-card",
        "bg-gradient-to-br from-violet-50/90 via-background to-indigo-50/50"
      )}
    >
      <div className="flex flex-col sm:flex-row gap-4 p-5 sm:p-6 md:p-7 min-h-[200px]">
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className={TEXT_LABEL}>Welcome</p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground mt-1">
            Internal Creative Hub
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
            Your visual library for brand assets, decks, templates and team resources — including
            the {GENERAL_GALLERY_FOLDER.title} on Google Drive.
          </p>
          <HeroActions
            search={search}
            onSearchChange={onSearchChange}
            canEdit={canEdit}
            onBrowseGallery={onBrowseGallery}
            onUpload={onUpload}
          />
        </div>
        <HeroIllustration />
      </div>
    </div>
  )
}

function HeroIllustration() {
  return (
    <div
      className="hidden sm:flex items-center justify-center shrink-0 w-36 md:w-44 lg:w-48"
      aria-hidden
    >
      <div className="relative w-full aspect-square max-w-[180px]">
        <div className="absolute inset-4 rounded-card-lg bg-violet-200/40 rotate-6 shadow-card" />
        <IllustrationCard
          className="absolute top-2 right-0 w-16 h-20 rounded-md bg-card shadow-card border border-border/40 flex items-center justify-center"
          icon={FolderOpen}
        />
        <IllustrationCard
          className="absolute bottom-4 left-0 w-20 h-14 rounded-md bg-card shadow-card border border-border/40 flex items-center justify-center"
          icon={ImageIcon}
        />
        <IllustrationCard
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-28 rounded-md bg-card shadow-elevated border border-border/50 flex items-center justify-center"
          icon={LayoutGrid}
        />
      </div>
    </div>
  )
}

function IllustrationCard({
  className,
  icon: Icon,
}: {
  className: string
  icon: typeof FolderOpen
}) {
  return (
    <div className={className}>
      <Icon className="h-6 w-6 text-violet-400/80" strokeWidth={1.25} />
    </div>
  )
}

function QuickAccessCol({
  quickAccess,
  onOpen,
}: {
  quickAccess: StaffHubAsset[]
  onOpen: (a: StaffHubAsset) => void
}) {
  return (
    <div className="lg:col-span-4 min-h-[200px]">
      <QuickAccessPanel items={quickAccess} onOpen={onOpen} className="h-full" />
    </div>
  )
}

function AssetsFilterBar({
  filters,
  setFilters,
  filterOptions,
  viewMode,
  setViewMode,
}: {
  filters: StaffHubFilters
  setFilters: React.Dispatch<React.SetStateAction<StaffHubFilters>>
  filterOptions: { types: string[]; tags: string[] }
  viewMode: "grid" | "list"
  setViewMode: (m: "grid" | "list") => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/30">
      <Select
        value={filters.type}
        onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}
      >
        <SelectTrigger className={cn(FILTER_CONTROL, "w-[110px]")} aria-label="Type">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {filterOptions.types.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.category}
        onValueChange={(v) =>
          setFilters((f) => ({ ...f, category: v as HubCategoryId | "all" }))
        }
      >
        <SelectTrigger className={cn(FILTER_CONTROL, "w-[130px]")} aria-label="Category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {HUB_CATEGORIES.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filterOptions.tags.length > 0 ? (
        <Select
          value={filters.tag}
          onValueChange={(v) => setFilters((f) => ({ ...f, tag: v }))}
        >
          <SelectTrigger className={cn(FILTER_CONTROL, "w-[100px]")} aria-label="Tag">
            <SelectValue placeholder="Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {filterOptions.tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <div className="flex items-center rounded-md border border-border/40 p-0.5 ml-auto">
        <button
          type="button"
          onClick={() => setViewMode("grid")}
          className={cn(
            "rounded p-1.5 transition-colors",
            viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Grid view"
        >
          <Grid3X3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={cn(
            "rounded p-1.5 transition-colors",
            viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="List view"
        >
          <List className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function HeroActions({
  search,
  onSearchChange,
  canEdit,
  onBrowseGallery,
  onUpload,
}: {
  search: string
  onSearchChange: (v: string) => void
  canEdit: boolean
  onBrowseGallery: () => void
  onUpload: () => void
}) {
  return (
    <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2 max-w-xl">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search assets, decks, templates…"
          className="pl-9 h-10 bg-background/80 border-border/50"
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0 gap-1.5 border-border/50"
        onClick={onBrowseGallery}
      >
        <FolderOpen className="h-4 w-4" />
        {GENERAL_GALLERY_FOLDER.title}
      </Button>
      {canEdit ? (
        <Button type="button" size="default" className="shrink-0 gap-1.5" onClick={onUpload}>
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      ) : null}
    </div>
  )
}
