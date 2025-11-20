"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, CheckSquare, Calendar, AlertCircle, Plus } from "lucide-react";
import { fetchOverview, OverviewData } from "@/lib/dashboard/fetchOverview";
import OverviewCard from "./OverviewCard";
import ContentPipeline from "./ContentPipeline";
import TaskList from "./TaskList";
import PublishCalendar from "./PublishCalendar";
import IdeaList from "./IdeaList";
import CampaignTimeline from "./CampaignTimeline";
import { useModal } from "@/lib/modalState";
import { useSearch } from "@/components/search/SearchProvider";

export default function Dashboard() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { setOpen: setModalOpen, setTableId: setModalTableId } = useModal();
  const { openSearch } = useSearch();

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
            onClick={openSearch}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <span>Search</span>
          </button>
        </div>
      </div>

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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ContentPipeline />
        <TaskList />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PublishCalendar />
        <IdeaList />
      </div>

      <div className="mb-6">
        <CampaignTimeline />
      </div>

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

