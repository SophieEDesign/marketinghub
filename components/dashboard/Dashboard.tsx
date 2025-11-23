"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { useDashboardBlocks } from "@/lib/hooks/useDashboardBlocks";
import { usePermissions } from "@/lib/hooks/usePermissions";
import DashboardBlock from "./DashboardBlock";
import BlockMenu, { BlockType } from "./blocks/BlockMenu";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";

function SortableBlockItem({
  block,
  isEditing,
  onUpdate,
  onDelete,
  isDragging,
}: {
  block: any;
  isEditing: boolean;
  onUpdate: (id: string, content: any) => void;
  onDelete: (id: string) => void;
  isDragging: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: block.id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <DashboardBlock
        block={block}
        isEditing={isEditing}
        onUpdate={onUpdate}
        onDelete={onDelete}
        isDragging={isDragging}
      />
    </div>
  );
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const dashboardId = searchParams.get("id") || "00000000-0000-0000-0000-000000000001";
  const permissions = usePermissions();
  const { blocks, loading, error, addBlock, updateBlock, deleteBlock, reorderBlocks } = useDashboardBlocks(dashboardId);
  const [isEditing, setIsEditing] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const canEdit = permissions.canModifyDashboards;

  const handleAddBlock = async (type: BlockType) => {
    try {
      await addBlock(type);
      setShowBlockMenu(false);
    } catch (error) {
      console.error("Error adding block:", error);
    }
  };

  const handleUpdateBlock = async (id: string, content: any) => {
    try {
      await updateBlock(id, { content });
    } catch (error) {
      console.error("Error updating block:", error);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await deleteBlock(id);
    } catch (error) {
      console.error("Error deleting block:", error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isEditing) {
      setActiveId(event.active.id as string);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id || !isEditing) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(blocks, oldIndex, newIndex).map((b) => b.id);
    await reorderBlocks(newOrder);
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
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={rectSortingStrategy}
          disabled={!isEditing}
        >
          {blocks.length === 0 ? (
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
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {blocks.map((block) => (
                <SortableBlockItem
                  key={block.id}
                  block={block}
                  isEditing={isEditing}
                  onUpdate={handleUpdateBlock}
                  onDelete={handleDeleteBlock}
                  isDragging={activeId === block.id}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
