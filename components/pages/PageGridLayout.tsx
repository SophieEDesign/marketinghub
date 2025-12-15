"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Layout, Layouts, Responsive, WidthProvider } from "react-grid-layout";
import { BlockConfig } from "@/lib/pages/blockTypes";
import PageBlockRenderer from "./PageBlockRenderer";

// Import CSS for react-grid-layout (client-side only)
if (typeof window !== "undefined") {
  try {
    require("react-grid-layout/css/styles.css");
    require("react-resizable/css/styles.css");
  } catch (e) {
    // CSS files may not be available during build
  }
}

const ResponsiveGridLayout = WidthProvider(Responsive);

interface PageGridLayoutProps {
  blocks: BlockConfig[];
  onBlocksChange: (blocks: BlockConfig[]) => void;
  editMode: boolean;
  recordContext?: Record<string, any>; // For visibility evaluation
  userRole?: string; // For permission checks
  onBlockUpdate?: (id: string, updates: Partial<BlockConfig>) => void;
  onBlockDelete?: (id: string) => void;
  onBlockSettings?: (block: BlockConfig) => void;
  onBlockDuplicate?: (block: BlockConfig) => void;
}

export default function PageGridLayout({
  blocks,
  onBlocksChange,
  editMode,
  recordContext,
  userRole,
  onBlockUpdate,
  onBlockDelete,
  onBlockSettings,
  onBlockDuplicate,
}: PageGridLayoutProps) {
  const [layouts, setLayouts] = useState<Layouts>({});
  const savedLayoutRef = useRef<Layouts>({});
  const layoutChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);

  // Convert blocks to react-grid-layout format
  const blocksToLayouts = useCallback((blocks: BlockConfig[]): Layouts => {
    const lg: Layout[] = blocks.map((block) => ({
      i: block.id,
      x: block.position.x,
      y: block.position.y,
      w: block.position.w,
      h: block.position.h,
      minW: 2,
      minH: 2,
    }));

    return {
      lg,
      md: lg,
      sm: lg,
      xs: lg,
      xxs: lg,
    };
  }, []);

  // Initialize layouts from blocks
  useEffect(() => {
    const newLayouts = blocksToLayouts(blocks);
    setLayouts(newLayouts);
    savedLayoutRef.current = newLayouts;
  }, [blocks, blocksToLayouts]);

  // Handle layout changes (drag/resize)
  const handleLayoutChange = useCallback(
    (currentLayout: Layout[], allLayouts: Layouts) => {
      if (!editMode) return;

      isDraggingRef.current = true;

      // Update layouts immediately for smooth UI
      setLayouts(allLayouts);
      savedLayoutRef.current = allLayouts;

      // Debounce: Save to parent after a short delay
      if (layoutChangeTimeoutRef.current) {
        clearTimeout(layoutChangeTimeoutRef.current);
      }

      layoutChangeTimeoutRef.current = setTimeout(() => {
        const updatedBlocks = currentLayout.map((item) => {
          const block = blocks.find((b) => b.id === item.i);
          if (!block) return null;

          return {
            ...block,
            position: {
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
            },
          };
        }).filter((b): b is BlockConfig => b !== null);

        onBlocksChange(updatedBlocks);
        isDraggingRef.current = false;
      }, 300);
    },
    [editMode, blocks, onBlocksChange]
  );

  // Smart reflow: automatically push blocks down when dragging upward
  const handleSmartReflow = useCallback(
    (layout: Layout[], oldItem: Layout, newItem: Layout, placeholder: Layout, e: MouseEvent, element: HTMLElement) => {
      if (!editMode) return;

      // Clone layout
      const newLayout = [...layout];

      // Sort blocks by y position (top to bottom), then by x (left to right)
      newLayout.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

      // Reflow algorithm: push blocks down if they overlap
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

      if (hasChanges) {
        const reflowedLayouts: Layouts = {
          lg: newLayout,
          md: newLayout,
          sm: newLayout,
          xs: newLayout,
          xxs: newLayout,
        };
        setLayouts(reflowedLayouts);
        savedLayoutRef.current = reflowedLayouts;

        // Update blocks with new positions
        const updatedBlocks = newLayout.map((item) => {
          const block = blocks.find((b) => b.id === item.i);
          if (!block) return null;

          return {
            ...block,
            position: {
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
            },
          };
        }).filter((b): b is BlockConfig => b !== null);

        onBlocksChange(updatedBlocks);
      }
    },
    [editMode, blocks, onBlocksChange]
  );

  if (!blocks || blocks.length === 0) {
    return null; // Don't render grid if no blocks
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      onLayoutChange={handleLayoutChange}
      onDragStop={handleSmartReflow}
      onResizeStop={handleSmartReflow}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 8, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={50}
      isDraggable={editMode}
      isResizable={editMode}
      draggableHandle={editMode ? ".react-grid-drag-handle" : undefined}
      margin={[16, 16]}
      containerPadding={[16, 16]}
      compactType="vertical"
      preventCollision={false}
      isBounded={true}
      allowOverlap={false}
    >
      {blocks.map((block) => (
        <div key={block.id} className="h-full w-full">
          <PageBlockRenderer
            block={block}
            isEditing={editMode}
            onUpdate={onBlockUpdate}
            onDelete={onBlockDelete}
            onOpenSettings={onBlockSettings}
            onDuplicate={onBlockDuplicate}
            recordContext={recordContext}
            userRole={userRole}
          />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
