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

  // Convert blocks to react-grid-layout format
  useEffect(() => {
    const lgLayout: Layout[] = blocks.map((block, index) => ({
      i: block.id,
      x: block.position_x ?? 0,
      y: block.position_y ?? index,
      w: block.width ?? 12,
      h: block.height ?? 6,
      minW: 2,
      minH: 2,
      // Prevent layout from collapsing blocks
      static: false,
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
          await onUpdateBlock(item.i, {
            position_x: item.x,
            position_y: item.y,
            width: item.w,
            height: item.h,
          });
        }
      }
    },
    [isEditing, blocks, onUpdateBlock]
  );

  const handleUpdateBlock = async (id: string, updates: { content?: any }) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;

    // Convert dashboard content format back to page config format
    const config = convertDashboardContentToPageConfig(updates.content || {}, block.type);
    
    // Also update position/size if provided
    const blockUpdates: Partial<InterfacePageBlock> = { config };
    if (updates.content?.position_x !== undefined) blockUpdates.position_x = updates.content.position_x;
    if (updates.content?.position_y !== undefined) blockUpdates.position_y = updates.content.position_y;
    if (updates.content?.width !== undefined) blockUpdates.width = updates.content.width;
    if (updates.content?.height !== undefined) blockUpdates.height = updates.content.height;

    await onUpdateBlock(id, blockUpdates);
  };

  return (
    <>
      {isEditing ? (
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
        <div className="space-y-4">
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
        </div>
      )}
      {selectedBlock && (
        <BlockSettingsDrawer
          block={convertPageBlockToDashboardBlock(selectedBlock)}
          open={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false);
            setSelectedBlock(null);
          }}
          updateBlock={async (id, updates) => {
            await handleUpdateBlock(id, updates);
            setIsSettingsOpen(false);
            setSelectedBlock(null);
          }}
        />
      )}
    </>
  );
}


