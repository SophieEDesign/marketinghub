"use client";

import { useState, useCallback, useEffect } from "react";
import { Layout, Layouts, Responsive, WidthProvider } from "react-grid-layout";

// Import CSS for react-grid-layout (client-side only)
if (typeof window !== "undefined") {
  try {
    require("react-grid-layout/css/styles.css");
    require("react-resizable/css/styles.css");
  } catch (e) {
    // CSS files may not be available during build
  }
}
import { X, Plus, Save, Edit2, Trash2, Settings } from "lucide-react";
import KPIModule from "./modules/KPI";
import PipelineModule from "./modules/Pipeline";
import TasksDueModule from "./modules/TasksDue";
import UpcomingEventsModule from "./modules/UpcomingEvents";
import CalendarMiniModule from "./modules/CalendarMini";
import TablePreviewModule from "./modules/TablePreview";
import CustomEmbedModule from "./modules/CustomEmbed";
import AddModulePanel from "./AddModulePanel";
import ModuleSettingsPanel from "./ModuleSettingsPanel";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardModule {
  id: string;
  dashboard_id?: string;
  type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  config: any;
}

interface DashboardEditorProps {
  dashboardId: string;
  modules: DashboardModule[];
  onModuleUpdate: (moduleId: string, updates: Partial<DashboardModule>) => Promise<void>;
  onModuleDelete: (moduleId: string) => Promise<void>;
  onModuleCreate: (module: Omit<DashboardModule, "id" | "dashboard_id">) => Promise<string>;
  data?: Record<string, any[]>;
}

export default function DashboardEditor({
  dashboardId,
  modules,
  onModuleUpdate,
  onModuleDelete,
  onModuleCreate,
  data = {},
}: DashboardEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingModule, setEditingModule] = useState<DashboardModule | null>(null);
  const [layouts, setLayouts] = useState<Layouts>({});

  // Convert modules to react-grid-layout format
  useEffect(() => {
    const lgLayout: Layout[] = modules.map((module) => ({
      i: module.id,
      x: module.position_x,
      y: module.position_y,
      w: module.width,
      h: module.height,
      minW: 2,
      minH: 2,
    }));

    setLayouts({
      lg: lgLayout,
      md: lgLayout,
      sm: lgLayout,
      xs: lgLayout,
      xxs: lgLayout,
    });
  }, [modules]);

  const handleLayoutChange = useCallback(
    async (currentLayout: Layout[], allLayouts: Layouts) => {
      if (!isEditing) return;

      // Update each module that changed
      const updates = currentLayout.map((item) => {
        const module = modules.find((m) => m.id === item.i);
        if (!module) return null;

        const hasChanged =
          module.position_x !== item.x ||
          module.position_y !== item.y ||
          module.width !== item.w ||
          module.height !== item.h;

        if (hasChanged) {
          return {
            id: item.i,
            updates: {
              position_x: item.x,
              position_y: item.y,
              width: item.w,
              height: item.h,
            },
          };
        }
        return null;
      });

      // Save all updates
      for (const update of updates) {
        if (update) {
          await onModuleUpdate(update.id, update.updates);
        }
      }
    },
    [isEditing, modules, onModuleUpdate]
  );

  const handleAddModule = useCallback(
    async (type: string, config: any) => {
      try {
        // Find the highest y position to place new module below existing ones
        const maxY = modules.length > 0
          ? Math.max(...modules.map((m) => m.position_y + m.height))
          : 0;

        const newModule: Omit<DashboardModule, "id" | "dashboard_id"> = {
          type,
          position_x: 0,
          position_y: maxY,
          width: type === "kpi" ? 3 : 4,
          height: type === "kpi" ? 3 : 4,
          config: config || {},
        };

        await onModuleCreate(newModule);
        setShowAddPanel(false);
      } catch (error) {
        console.error("Error in handleAddModule:", error);
        throw error; // Re-throw to be handled by AddModulePanel
      }
    },
    [modules, onModuleCreate]
  );

  const renderModule = (module: DashboardModule) => {
    const commonProps = {
      config: module.config,
      width: module.width,
      height: module.height,
      isEditing,
      onUpdate: (updates: any) => onModuleUpdate(module.id, { config: { ...module.config, ...updates } }),
    };

    switch (module.type) {
      case "kpi":
        return <KPIModule {...commonProps} data={module.config.table ? data[module.config.table] : undefined} />;
      case "pipeline":
        return <PipelineModule {...commonProps} data={data[module.config.table] || []} />;
      case "tasks_due":
        return <TasksDueModule {...commonProps} data={data[module.config.table] || []} />;
      case "upcoming_events":
        return <UpcomingEventsModule {...commonProps} data={data[module.config.table] || []} />;
      case "calendar_mini":
        return <CalendarMiniModule {...commonProps} data={data[module.config.table] || []} />;
      case "table_preview":
        return <TablePreviewModule {...commonProps} data={data[module.config.table] || []} />;
      case "custom_embed":
        return <CustomEmbedModule {...commonProps} />;
      default:
        return (
          <div className="h-full bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-center">
            <p className="text-sm text-gray-500">Unknown module type: {module.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-heading text-brand-blue">Dashboard</h1>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setShowAddPanel(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Module
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Layout
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {modules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No modules yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Get started by adding your first dashboard module. Click "Edit Layout" and then "Add Module" to begin.
            </p>
            <button
              onClick={() => {
                setIsEditing(true);
                setShowAddPanel(true);
              }}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Add Your First Module
            </button>
          </div>
        </div>
      ) : (
        /* Grid Layout */
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 8, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={50}
          isDraggable={isEditing}
          isResizable={isEditing}
          draggableHandle={isEditing ? undefined : ".no-drag"}
          margin={[16, 16]}
          containerPadding={[0, 0]}
        >
          {modules.map((module) => (
            <div key={module.id} className="relative">
              {isEditing && (
                <>
                  <button
                    onClick={() => setEditingModule(module)}
                    className="absolute -top-2 -left-2 z-50 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg"
                    title="Module settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onModuleDelete(module.id)}
                    className="absolute -top-2 -right-2 z-50 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg"
                    title="Delete module"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
              {renderModule(module)}
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      {/* Add Module Panel */}
      {showAddPanel && (
        <AddModulePanel
          open={showAddPanel}
          onClose={() => setShowAddPanel(false)}
          onAdd={handleAddModule}
        />
      )}

      {/* Module Settings Panel */}
      {editingModule && (
        <ModuleSettingsPanel
          open={!!editingModule}
          onClose={() => setEditingModule(null)}
          module={editingModule}
          onUpdate={async (updates) => {
            await onModuleUpdate(editingModule.id, updates);
            setEditingModule(null);
          }}
        />
      )}
    </div>
  );
}

