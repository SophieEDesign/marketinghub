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

import { GripVertical, Plus, Settings, X, Copy, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import { renderPageBlock } from "./blocks/BlockRenderer";
import BlockSettingsPanel from "./BlockSettingsPanel";

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
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<Layouts>({});

  // Convert blocks to react-grid-layout format
  useEffect(() => {
    const lgLayout: Layout[] = blocks.map((block) => ({
      i: block.id,
      x: block.position_x || 0,
      y: block.position_y || 0,
      w: block.width || 12,
      h: block.height || 6,
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

  const handleDuplicate = async (block: InterfacePageBlock) => {
    // Create a duplicate block
    const newBlock = {
      ...block,
      id: `temp-${Date.now()}`,
      position_x: (block.position_x || 0) + 1,
      position_y: (block.position_y || 0) + 1,
    };
    // The parent component will handle creating it via API
    onAddBlock(block.type);
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
        >
          {blocks.map((block) => (
            <div key={block.id} className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <BlockWrapper
                block={block}
                isEditing={isEditing}
                isDragging={false}
                onEdit={() => setEditingBlockId(block.id)}
                onDuplicate={() => handleDuplicate(block)}
                onDelete={() => onDeleteBlock(block.id)}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      ) : (
        <div className="space-y-4">
          {blocks.map((block) => (
            <BlockWrapper
              key={block.id}
              block={block}
              isEditing={isEditing}
              isDragging={false}
              onEdit={() => setEditingBlockId(block.id)}
              onDuplicate={() => handleDuplicate(block)}
              onDelete={() => onDeleteBlock(block.id)}
            />
          ))}
        </div>
      )}
      <BlockSettingsPanel
        block={editingBlockId ? blocks.find((b) => b.id === editingBlockId) || null : null}
        isOpen={editingBlockId !== null}
        onClose={() => setEditingBlockId(null)}
        onUpdate={onUpdateBlock}
      />
    </>
  );
}

function BlockWrapper({
  block,
  isEditing,
  isDragging,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  block: InterfacePageBlock;
  isEditing: boolean;
  isDragging: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`relative border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {isEditing && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-1 shadow-sm">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Duplicate"
          >
            <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}
      {isEditing && (
        <div className="absolute top-2 left-2 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-1 cursor-move">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
      )}
      <div className="p-4">
        {renderPageBlock(block)}
      </div>
    </div>
  );
}

