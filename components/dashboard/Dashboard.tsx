"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, CheckSquare, Calendar, AlertCircle, Plus, Edit3, Check } from "lucide-react";
import { fetchOverview, OverviewData } from "@/lib/dashboard/fetchOverview";
import OverviewCard from "./OverviewCard";
import ContentPipeline from "./ContentPipeline";
import TaskList from "./TaskList";
import PublishCalendar from "./PublishCalendar";
import IdeaList from "./IdeaList";
import CampaignTimeline from "./CampaignTimeline";
import MediaList from "./MediaList";
import SponsorshipsList from "./SponsorshipsList";
import StrategyList from "./StrategyList";
import BriefingsList from "./BriefingsList";
import AssetsList from "./AssetsList";
import DashboardSortableModule from "./DashboardSortableModule";
import { useModal } from "@/lib/modalState";
import { useSearch } from "@/components/search/SearchProvider";
import { supabase } from "@/lib/supabaseClient";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

// Define dashboard modules with their IDs and components
interface DashboardModule {
  id: string;
  component: React.ComponentType;
}

const dashboardModules: DashboardModule[] = [
  { id: "content-pipeline", component: ContentPipeline },
  { id: "tasks-overview", component: TaskList },
  { id: "publish-calendar", component: PublishCalendar },
  { id: "ideas-list", component: IdeaList },
  { id: "campaign-timeline", component: CampaignTimeline },
  { id: "media-list", component: MediaList },
  { id: "sponsorships-list", component: SponsorshipsList },
  { id: "strategy-list", component: StrategyList },
  { id: "briefings-list", component: BriefingsList },
  { id: "assets-list", component: AssetsList },
];

export default function Dashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [orderedModules, setOrderedModules] = useState(dashboardModules);
  const [loadingLayout, setLoadingLayout] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { setOpen: setModalOpen, setTableId: setModalTableId } = useModal();
  const { openSearch } = useSearch();

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load saved dashboard layout from Supabase
  useEffect(() => {
    async function loadLayout() {
      try {
        const { data, error } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "dashboard_layout")
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error loading dashboard layout:", error);
        }

        const savedOrder = (data?.value as Array<{ id: string }>) || [];

        if (savedOrder.length > 0) {
          const ordered = savedOrder
            .map((saved) => dashboardModules.find((m) => m.id === saved.id))
            .filter((item): item is DashboardModule => item !== undefined);

          // Add any modules that weren't in saved order (new modules)
          const missingModules = dashboardModules.filter(
            (module) => !savedOrder.some((saved) => saved.id === module.id)
          );

          setOrderedModules([...ordered, ...missingModules]);
        } else {
          setOrderedModules(dashboardModules);
        }
      } catch (err) {
        console.error("Error loading dashboard layout:", err);
        setOrderedModules(dashboardModules);
      } finally {
        setLoadingLayout(false);
      }
    }

    loadLayout();
  }, []);

  // Disable editing on mobile
  useEffect(() => {
    if (isMobile && editing) {
      setEditing(false);
    }
  }, [isMobile, editing]);

  useEffect(() => {
    async function load() {
      const data = await fetchOverview();
      setOverview(data);
      setLoading(false);
    }

    load();
  }, []);

  const handleQuickAction = (table: string) => {
    setModalTableId(table);
    setModalOpen(true);
  };

  // Handle drag end for module reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedModules.findIndex((m) => m.id === active.id);
    const newIndex = orderedModules.findIndex((m) => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(orderedModules, oldIndex, newIndex);

    // Update local state immediately
    setOrderedModules(newOrder);

    // Save to Supabase
    try {
      const { error } = await supabase
        .from("settings")
        .upsert({
          key: "dashboard_layout",
          value: newOrder.map((m) => ({ id: m.id })),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error("Error saving dashboard layout:", error);
        // Revert on error
        setOrderedModules(dashboardModules);
      }
    } catch (err) {
      console.error("Error saving dashboard layout:", err);
      // Revert on error
      setOrderedModules(dashboardModules);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading text-brand-blue">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Overview of your marketing workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(!editing)}
            disabled={isMobile}
            className={`btn-secondary text-sm flex items-center gap-2 ${
              isMobile ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={isMobile ? "Drag-and-drop not available on mobile" : undefined}
          >
            {editing ? (
              <>
                <Check className="w-4 h-4" />
                Done
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                Edit Layout
              </>
            )}
          </button>
          <button
            onClick={openSearch}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <span>Search</span>
          </button>
        </div>
      </div>

      {/* Editing Mode Banner */}
      {editing && !isMobile && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          <strong>Editing layout mode:</strong> Drag modules to reorder them. Click "Done" when finished.
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <OverviewCard
          title="Content This Month"
          value={overview?.contentThisMonth || 0}
          icon={<FileText className="w-5 h-5" />}
          color="blue"
          onClick={() => router.push("/content/grid")}
        />
        <OverviewCard
          title="Tasks Due"
          value={overview?.tasksDue || 0}
          icon={<CheckSquare className="w-5 h-5" />}
          color="red"
          onClick={() => router.push("/tasks/grid")}
        />
        <OverviewCard
          title="Active Campaigns"
          value={overview?.activeCampaigns || 0}
          icon={<Calendar className="w-5 h-5" />}
          color="green"
          onClick={() => router.push("/campaigns/grid")}
        />
        <OverviewCard
          title="Needs Attention"
          value={overview?.itemsNeedingAttention || 0}
          icon={<AlertCircle className="w-5 h-5" />}
          color="yellow"
          onClick={() => router.push("/content/grid?needs_attention=true")}
        />
      </div>

      {/* Draggable Modules */}
      {loadingLayout ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Loading dashboard layout...
        </div>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedModules.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {orderedModules.map((module) => {
                const ModuleComponent = module.component;
                return (
                  <DashboardSortableModule
                    key={module.id}
                    id={module.id}
                    editing={editing}
                    isMobile={isMobile}
                  >
                    <ModuleComponent />
                  </DashboardSortableModule>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <div className="relative group">
          <button
            className="w-14 h-14 rounded-full bg-brand-red text-white shadow-lg hover:shadow-xl transition flex items-center justify-center"
            onClick={() => {
              // Toggle menu or show dropdown
              const menu = document.getElementById("fab-menu");
              if (menu) {
                menu.classList.toggle("hidden");
              }
            }}
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* Quick Actions Menu */}
          <div
            id="fab-menu"
            className="absolute bottom-16 right-0 mb-2 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
          >
            <button
              onClick={() => handleQuickAction("content")}
              className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              New Content
            </button>
            <button
              onClick={() => handleQuickAction("campaigns")}
              className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-sm flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              New Campaign
            </button>
            <button
              onClick={() => handleQuickAction("tasks")}
              className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-sm flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              New Task
            </button>
            <button
              onClick={() => handleQuickAction("ideas")}
              className="w-full text-left px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Idea
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

