"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import DashboardBlock from "@/components/dashboard/DashboardBlock";
import BlockSettingsDrawer from "@/components/dashboard/blocks/BlockSettingsDrawer";
import { convertPageBlockToDashboardBlock, convertDashboardContentToPageConfig } from "@/lib/utils/pageBlockAdapter";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface PageBuilderProps {
  pageId: string;
  blocks: InterfacePageBlock[];
  isEditing: boolean;
  onAddBlock: (type: string) => void;
  onUpdateBlock: (id: string, updates: Partial<InterfacePageBlock>) => void;
  onDeleteBlock: (id: string) => void;
  onReorderBlocks: (blockIds: string[]) => void;
}

export default function PageBuilder({
  pageId,
  blocks,
  isEditing,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  onReorderBlocks,
}: PageBuilderProps) {
  const [selectedBlock, setSelectedBlock] = useState<InterfacePageBlock | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [layouts, setLayouts] = useState<Layouts>({});
  const layoutChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const isDraggingRef = useRef<boolean>(false);
  const savedLayoutRef = useRef<Layouts | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const previousLayoutRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const previousLayoutsRef = useRef<Layouts>({});

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (layoutChangeTimeoutRef.current) {
        clearTimeout(layoutChangeTimeoutRef.current);
      }
    };
  }, []);

  // Convert blocks to react-grid-layout format
  // Only update if we're not in the middle of a drag operation
  useEffect(() => {
    // Skip if user is actively dragging, there are pending updates, or we're saving
    if (isDraggingRef.current || pendingUpdatesRef.current.size > 0 || isSavingRef.current) {
      return;
    }

    // Check if layout properties (position/size) have actually changed
    // If only config/content changed, don't recalculate layout
    const layoutChanged = blocks.some((block) => {
      const prev = previousLayoutRef.current.get(block.id);
      if (!prev) return true; // New block, needs layout
      return (
        prev.x !== (block.position_x ?? 0) ||
        prev.y !== (block.position_y ?? 0) ||
        prev.w !== (block.width ?? 3) ||
        prev.h !== (block.height ?? 3)
      );
    });

    // Update previous layout ref
    blocks.forEach((block) => {
      previousLayoutRef.current.set(block.id, {
        x: block.position_x ?? 0,
        y: block.position_y ?? 0,
        w: block.width ?? 3,
        h: block.height ?? 3,
      });
    });

    // If layout hasn't changed and we have a saved layout, keep using it
    if (!layoutChanged && savedLayoutRef.current && Object.keys(savedLayoutRef.current).length > 0) {
      return;
    }

    // If layout hasn't changed and we have existing layouts, don't recalculate
    if (!layoutChanged && Object.keys(layouts).length > 0) {
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
            // More forgiving comparison - allow small differences due to rounding
            const xMatch = Math.abs(layoutItem.x - (block.position_x ?? 0)) <= 1;
            const yMatch = Math.abs(layoutItem.y - (block.position_y ?? 0)) <= 1;
            const wMatch = Math.abs(layoutItem.w - (block.width ?? 3)) <= 1;
            const hMatch = Math.abs(layoutItem.h - (block.height ?? 3)) <= 1;
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

    // Get default block height (default: 3 rows)
    const getDefaultBlockHeight = () => {
      if (typeof window === 'undefined') return 3;
      const saved = localStorage.getItem('dashboardDefaultBlockHeight');
      return saved ? parseInt(saved, 10) : 3;
    };

    const defaultHeight = getDefaultBlockHeight();
    const lgLayout: Layout[] = blocks.map((block, index) => ({
      i: block.id,
      x: block.position_x ?? (index % 4) * 3, // Default: 3 columns per block, spread horizontally
      y: block.position_y ?? Math.floor(index / 4) * defaultHeight, // Default: stack vertically
      w: block.width ?? 3, // Default width: 3 columns
      h: block.height ?? defaultHeight, // Default height from settings
      minW: 2,
      minH: 2,
      // Prevent layout from collapsing blocks
      static: false,
    }));

    // Only update layouts if they've actually changed (compare with previous layout)
    const prevLayout = previousLayoutsRef.current.lg || [];
    const layoutsChanged = 
      prevLayout.length !== lgLayout.length ||
      lgLayout.some((newItem) => {
        const prevItem = prevLayout.find((item) => item.i === newItem.i);
        if (!prevItem) return true; // New item
        return (
          prevItem.x !== newItem.x ||
          prevItem.y !== newItem.y ||
          prevItem.w !== newItem.w ||
          prevItem.h !== newItem.h
        );
      });

    if (layoutsChanged) {
      const newLayouts = {
      lg: lgLayout,
      md: lgLayout,
      sm: lgLayout,
      xs: lgLayout,
      xxs: lgLayout,
      };
      setLayouts(newLayouts);
      // Update ref for next comparison
      previousLayoutsRef.current = newLayouts;
    }
  }, [blocks]);

  // Airtable-style smart reflow: automatically push blocks down when dragging upward
  const handleSmartReflow = useCallback(
    (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, e: MouseEvent, element: HTMLElement) => {
      if (!isEditing) return;

      // Step 1 — clone layout
      const newLayout = [...layout];

      // Step 2 — sort blocks by y position (top to bottom), then by x (left to right)
      newLayout.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

      // Step 3 — reflow algorithm (Airtable behaviour)
      // Push blocks down if they overlap or touch the previous block
      let hasChanges = false;
      for (let i = 1; i < newLayout.length; i++) {
        const prev = newLayout[i - 1];
        const curr = newLayout[i];

        // If curr overlaps or touches prev vertically, push it down below prev
        if (curr.y < prev.y + prev.h) {
          curr.y = prev.y + prev.h;
          hasChanges = true;
        }
      }

      // Step 4 — only update if changes were made
      if (hasChanges) {
        // Update layouts with reflowed positions
        const reflowedLayouts: Layouts = {
          lg: newLayout,
          md: newLayout,
          sm: newLayout,
          xs: newLayout,
          xxs: newLayout,
        };
        setLayouts(reflowedLayouts);
        savedLayoutRef.current = reflowedLayouts;

        // Step 5 — save updated layout to DB (store pending updates)
        for (const item of newLayout) {
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

        // Clear existing timeout
        if (layoutChangeTimeoutRef.current) {
          clearTimeout(layoutChangeTimeoutRef.current);
        }

        // Debounce: Save to database after a short delay
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
              await onUpdateBlock(blockId, {
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
          setTimeout(() => {
            isDraggingRef.current = false;
            setTimeout(() => {
              isSavingRef.current = false;
            }, 800);
          }, 300);
        }, 300);
      }
    },
    [isEditing, blocks, onUpdateBlock]
  );

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
      // Also update previous layout ref to keep it in sync
      previousLayoutsRef.current = allLayouts;

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
            await onUpdateBlock(blockId, {
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
    [isEditing, blocks, onUpdateBlock]
  );

  const handleUpdateBlock = async (id: string, content: any) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) {
      console.error("Block not found:", id);
      return;
    }

    // Merge with existing config to preserve any fields not in content
    const existingConfig = block.config || {};
    
    // Convert dashboard content format back to page config format
    const newConfig = convertDashboardContentToPageConfig(content || {}, block.type);
    
    // Merge new config with existing config
    const mergedConfig = { ...existingConfig, ...newConfig };
    
    // Also update position/size if provided in content
    const blockUpdates: Partial<InterfacePageBlock> = { config: mergedConfig };
    if (content?.position_x !== undefined) blockUpdates.position_x = content.position_x;
    if (content?.position_y !== undefined) blockUpdates.position_y = content.position_y;
    if (content?.width !== undefined) blockUpdates.width = content.width;
    if (content?.height !== undefined) blockUpdates.height = content.height;

    console.log("Updating block:", id, "with config:", mergedConfig);
    await onUpdateBlock(id, blockUpdates);
  };

  return (
    <>
      {isEditing ? (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          onDragStop={handleSmartReflow}
          onResizeStop={handleSmartReflow}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 8, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={50}
          isDraggable={isEditing}
          isResizable={isEditing}
          draggableHandle=".react-grid-drag-handle"
          margin={[16, 16]}
          containerPadding={[16, 16]}
          compactType="vertical"
          preventCollision={false}
          isBounded={true}
          allowOverlap={false}
        >
          {blocks.map((block) => {
            const dashboardBlock = convertPageBlockToDashboardBlock(block);
            return (
              <div key={block.id} className="h-full">
                <DashboardBlock
                  block={dashboardBlock}
                  isEditing={isEditing}
                  onUpdate={handleUpdateBlock}
                  onDelete={onDeleteBlock}
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
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          onLayoutChange={() => {}} // No-op in view mode
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 8, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={50}
          isDraggable={false}
          isResizable={false}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          preventCollision={true}
          compactType={null}
        >
          {blocks.map((block) => {
            const dashboardBlock = convertPageBlockToDashboardBlock(block);
            return (
              <div key={block.id} className="h-full">
                <DashboardBlock
                  block={dashboardBlock}
                  isEditing={isEditing}
                  onUpdate={handleUpdateBlock}
                  onDelete={onDeleteBlock}
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
      {selectedBlock && (
        <BlockSettingsDrawer
          block={convertPageBlockToDashboardBlock(selectedBlock)}
          open={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false);
            setSelectedBlock(null);
          }}
          onUpdate={async (id, updates) => {
            await handleUpdateBlock(id, updates);
            setIsSettingsOpen(false);
            setSelectedBlock(null);
          }}
        />
      )}
    </>
  );
}


