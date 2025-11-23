"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical, Plus, Settings, X, Copy, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import { renderPageBlock } from "./blocks/BlockRenderer";
import BlockSettingsPanel from "./BlockSettingsPanel";

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (isEditing) {
      setActiveId(event.active.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id || !isEditing) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(oldIndex, 1);
    newBlocks.splice(newIndex, 0, moved);

    // Update positions
    const updatedBlocks = newBlocks.map((block, index) => ({
      ...block,
      position_y: index,
    }));

    onReorderBlocks(updatedBlocks.map((b) => b.id));
  };

  const handleDuplicate = async (block: InterfacePageBlock) => {
    const newBlock = {
      ...block,
      id: `temp-${Date.now()}`,
      position_y: block.position_y + 1,
    };
    // TODO: Create via API
  };

  // Sort blocks by position
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (a.position_y !== b.position_y) {
      return a.position_y - b.position_y;
    }
    return a.position_x - b.position_x;
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedBlocks.map((b) => b.id)}
        strategy={rectSortingStrategy}
        disabled={!isEditing}
      >
        <div className="space-y-4">
          {sortedBlocks.map((block) => (
            <BlockWrapper
              key={block.id}
              block={block}
              isEditing={isEditing}
              isDragging={activeId === block.id}
              onEdit={() => setEditingBlockId(block.id)}
              onDuplicate={() => handleDuplicate(block)}
              onDelete={() => onDeleteBlock(block.id)}
            />
          ))}
        </div>
      </SortableContext>
      <BlockSettingsPanel
        block={editingBlockId ? blocks.find((b) => b.id === editingBlockId) || null : null}
        isOpen={editingBlockId !== null}
        onClose={() => setEditingBlockId(null)}
        onUpdate={onUpdateBlock}
      />
    </DndContext>
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

