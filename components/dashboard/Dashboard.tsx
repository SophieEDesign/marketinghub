"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Layout, Layouts, Responsive, WidthProvider } from "react-grid-layout";
import { supabase } from "@/lib/supabaseClient";

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
  const [dashboardName, setDashboardName] = useState<string>("Dashboard");
  const layoutChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const isDraggingRef = useRef<boolean>(false);
  const savedLayoutRef = useRef<Layouts | null>(null);
  const isSavingRef = useRef<boolean>(false);

  const canEdit = permissions.canModifyDashboards;

  // Fetch dashboard name
  useEffect(() => {
    const fetchDashboardName = async () => {
      try {
        const { data, error } = await supabase
          .from("dashboards")
          .select("name")
          .eq("id", dashboardId)
          .maybeSingle();

        if (error) {
          console.error("Error fetching dashboard name:", error);
          return;
        }

        if (data) {
          setDashboardName(data.name || "Dashboard");
        } else {
          // If dashboard doesn't exist, use default name
          setDashboardName("Dashboard");
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err);
      }
    };

    fetchDashboardName();
  }, [dashboardId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (layoutChangeTimeoutRef.current) {
        clearTimeout(layoutChangeTimeoutRef.current);
      }
    };
  }, []);

  // Get default block height from settings (default: 3)
  const getDefaultBlockHeight = () => {
    if (typeof window === 'undefined') return 3;
    const saved = localStorage.getItem('dashboardDefaultBlockHeight');
    return saved ? parseInt(saved, 10) : 3;
  };

  // Convert blocks to react-grid-layout format
  // Only update if we're not in the middle of a drag operation
  useEffect(() => {
    // Skip if user is actively dragging, there are pending updates, or we're saving
    if (isDraggingRef.current || pendingUpdatesRef.current.size > 0 || isSavingRef.current) {
      return;
    }

    // If we have a saved layout from dragging, ALWAYS use it while it exists
    // This prevents reverting during the save process
    if (savedLayoutRef.current && Object.keys(savedLayoutRef.current).length > 0) {
      const savedLayout = savedLayoutRef.current.lg || [];
      // Only check if we have the same number of blocks
      if (savedLayout.length === blocks.length) {
        // Check if blocks now match the saved layout (save completed)
        // Only clear if blocks match AND we're not saving
        if (!isSavingRef.current) {
          const allBlocksMatch = blocks.every((block) => {
            const layoutItem = savedLayout.find((l) => l.i === block.id);
            if (!layoutItem) return false;
            const xMatch = Math.abs(layoutItem.x - (block.position_x ?? 0)) <= 1;
            const yMatch = Math.abs(layoutItem.y - (block.position_y ?? 0)) <= 1;
            const wMatch = layoutItem.w === (block.width ?? 3);
            const hMatch = layoutItem.h === (block.height ?? 3);
            return xMatch && yMatch && wMatch && hMatch;
          });

          if (allBlocksMatch) {
            // Blocks match saved layout - save is complete!
            // Clear saved layout and recalculate from blocks
            savedLayoutRef.current = null;
            // Continue to recalculate from blocks below
          } else {
            // Blocks don't match yet - keep using saved layout to prevent revert
            setLayouts(savedLayoutRef.current);
            return;
          }
        } else {
          // Still saving - use saved layout
          setLayouts(savedLayoutRef.current);
          return;
        }
      } else {
        // Block count changed, clear saved layout and recalculate
        savedLayoutRef.current = null;
      }
    }

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
    (currentLayout: Layout[], allLayouts: Layouts) => {
      if (!isEditing) return;

      // Mark as dragging
      isDraggingRef.current = true;

      // Store pending updates instead of immediately calling API
      for (const item of currentLayout) {
        const block = blocks.find((b) => b.id === item.i);
        if (!block) continue;

        const hasChanged =
          block.position_x !== item.x ||
          block.position_y !== item.y ||
          block.width !== item.w ||
          block.height !== item.h;

        if (hasChanged) {
          pendingUpdatesRef.current.set(item.i, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          });
        }
      }

      // Update layouts immediately to reflect drag position
      setLayouts(allLayouts);
      // Save current layout to prevent reverting
      savedLayoutRef.current = allLayouts;

      // Clear existing timeout
      if (layoutChangeTimeoutRef.current) {
        clearTimeout(layoutChangeTimeoutRef.current);
      }

      // Debounce: Only save to database after user stops dragging/resizing (500ms delay)
      layoutChangeTimeoutRef.current = setTimeout(async () => {
        const updates = Array.from(pendingUpdatesRef.current.entries());
        
        if (updates.length === 0) {
          isDraggingRef.current = false;
          isSavingRef.current = false;
          return;
        }

        // Mark as saving to prevent layout recalculation
        isSavingRef.current = true;
        
        // Store the updates we're about to make
        const updatesToApply = new Map(updates);

        // Batch update all changed blocks
        const updatePromises = Array.from(updatesToApply.entries()).map(async ([blockId, layout]) => {
          try {
            await updateBlock(blockId, {
              position_x: layout.x,
              position_y: layout.y,
              width: layout.w,
              height: layout.h,
            });
            return { blockId, success: true };
          } catch (error) {
            console.error(`Error updating block ${blockId}:`, error);
            return { blockId, success: false, error };
        }
        });

        await Promise.all(updatePromises);

        // Clear pending updates AFTER all updates complete
        pendingUpdatesRef.current.clear();
        
        // Wait for blocks state to update from the database
        // Keep saved layout active during this time
        setTimeout(() => {
          isDraggingRef.current = false;
          // Wait longer for blocks state to fully update
          setTimeout(() => {
            // Clear saving flag - saved layout will persist until blocks match
            isSavingRef.current = false;
            
            // Don't clear savedLayoutRef here - let the useEffect handle it
            // when it detects blocks match the saved layout
          }, 800);
        }, 300);
      }, 500);
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
      // BlockSettingsDrawer passes content directly, not wrapped in { content: ... }
      // Check if updates looks like content (has title, limit, etc.) vs block metadata
      const isContentUpdate = updates && (
        updates.title !== undefined ||
        updates.limit !== undefined ||
        updates.filters !== undefined ||
        updates.table !== undefined ||
        updates.fields !== undefined ||
        updates.html !== undefined ||
        updates.url !== undefined ||
        updates.caption !== undefined ||
        updates.aggregate !== undefined ||
        updates.dateField !== undefined
      ) && !updates.id && !updates.dashboard_id && !updates.type;
      
      if (isContentUpdate) {
        // This is a content update from BlockSettingsDrawer
        await updateBlock(id, { content: updates });
      } else if (updates.content) {
        // This is already wrapped in { content: ... }
        await updateBlock(id, { content: updates.content });
      } else {
        // This is a metadata update (position, width, height, etc.)
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
          {dashboardName}
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
                className="fixed inset-0 bg-black/40 z-[9998]"
                onClick={() => setShowBlockMenu(false)}
              />
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
                <div className="pointer-events-auto max-h-[80vh] overflow-y-auto">
                <BlockMenu
                  onSelectBlockType={handleAddBlock}
                />
                </div>
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
          draggableHandle={isEditing ? ".react-grid-drag-handle" : undefined}
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
              <div key={block.id} className="h-full w-full">
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
