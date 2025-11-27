"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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

import Button from "@/components/ui/Button";
import { useDashboardBlocks } from "@/lib/hooks/useDashboardBlocks";
import { usePermissions } from "@/lib/hooks/usePermissions";
import DashboardBlock from "./DashboardBlock";
import BlockMenu, { BlockType } from "./blocks/BlockMenu";
import BlockSettingsDrawer from "./blocks/BlockSettingsDrawer";
import { Plus } from "lucide-react";

const ResponsiveGridLayout = WidthProvider(Responsive);


export default function Dashboard() {
  const searchParams = useSearchParams();
  const dashboardId = searchParams.get("id") || "00000000-0000-0000-0000-000000000001";
  const permissions = usePermissions();
  const { blocks, loading, error, addBlock, updateBlock, deleteBlock } = useDashboardBlocks(dashboardId);
  const [isEditing, setIsEditing] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<any | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [layouts, setLayouts] = useState<Layouts>({});

  const canEdit = permissions.canModifyDashboards;

  // Get default block height from settings (default: 3)
  const getDefaultBlockHeight = () => {
    if (typeof window === 'undefined') return 3;
    const saved = localStorage.getItem('dashboardDefaultBlockHeight');
    return saved ? parseInt(saved, 10) : 3;
  };

  // Convert blocks to react-grid-layout format
  useEffect(() => {
    const defaultHeight = getDefaultBlockHeight();
    const lgLayout: Layout[] = blocks.map((block, index) => ({
      i: block.id,
      x: block.position_x ?? (index % 4) * 3, // Default: 3 columns per block
      y: block.position_y ?? Math.floor(index / 4) * defaultHeight, // Default rows per block
      w: block.width ?? 3, // Default width: 3 columns
      h: block.height ?? defaultHeight, // Default height from settings
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
  }, [blocks]);

  const handleLayoutChange = useCallback(
    async (currentLayout: Layout[], allLayouts: Layouts) => {
      if (!isEditing) return;

      // Update each block that changed
      for (const item of currentLayout) {
        const block = blocks.find((b) => b.id === item.i);
        if (!block) continue;

        const hasChanged =
          block.position_x !== item.x ||
          block.position_y !== item.y ||
          block.width !== item.w ||
          block.height !== item.h;

        if (hasChanged) {
          await updateBlock(item.i, {
            position_x: item.x,
            position_y: item.y,
            width: item.w,
            height: item.h,
          });
        }
      }
    },
    [isEditing, blocks, updateBlock]
  );

  const handleAddBlock = async (type: BlockType) => {
    try {
      await addBlock(type);
      setShowBlockMenu(false);
    } catch (error: any) {
      console.error("Error adding block:", error);
      alert(`Failed to add block: ${error.message || "Unknown error"}`);
    }
  };

  const handleUpdateBlock = async (id: string, updates: any) => {
    try {
      // If updates contain content, merge it properly
      if (updates.content) {
        await updateBlock(id, { content: updates.content });
      } else {
        await updateBlock(id, updates);
      }
    } catch (error: any) {
      console.error("Error updating block:", error);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!confirm("Are you sure you want to delete this block?")) {
      return;
    }
    try {
      await deleteBlock(id);
    } catch (error: any) {
      console.error("Error deleting block:", error);
      alert(`Failed to delete block: ${error.message || "Unknown error"}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-4">
            Dashboard Error
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Finish Editing" : "Edit Layout"}
          </Button>
        )}
      </div>

      {/* Add Block Button (only in edit mode) */}
      {isEditing && canEdit && (
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setShowBlockMenu(!showBlockMenu)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Block
          </Button>
          {showBlockMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowBlockMenu(false)}
              />
              <div className="absolute top-full left-0 mt-2 z-50">
                <BlockMenu
                  onSelectBlockType={handleAddBlock}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Blocks Grid */}
      {!blocks || blocks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <p className="mb-4">No blocks yet.</p>
          {canEdit && !isEditing && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              Edit Layout to Add Blocks
            </Button>
          )}
        </div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 8, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={50}
          isDraggable={isEditing}
          isResizable={isEditing}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          preventCollision={true}
          compactType={null}
          allowOverlap={false}
        >
          {blocks.map((block) => {
            if (!block || !block.id) {
              console.warn("Invalid block found:", block);
              return null;
            }
            return (
              <div key={block.id} className="h-full">
                <DashboardBlock
                  block={block}
                  isEditing={isEditing}
                  onUpdate={handleUpdateBlock}
                  onDelete={handleDeleteBlock}
                  onOpenSettings={() => {
                    setSelectedBlock(block);
                    setIsSettingsOpen(true);
                  }}
                  isDragging={false}
                />
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}

      {/* Settings Drawer */}
      <BlockSettingsDrawer
        block={selectedBlock}
        open={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setSelectedBlock(null);
        }}
        onUpdate={handleUpdateBlock}
      />
    </div>
  );
}
