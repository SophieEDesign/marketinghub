"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import TextBlock from "./blocks/TextBlock";
import ImageBlock from "./blocks/ImageBlock";
import EmbedBlock from "./blocks/EmbedBlock";
import BlockMenu from "./blocks/BlockMenu";
import { supabase } from "@/lib/supabaseClient";

interface DashboardBlock {
  id: string;
  dashboard_id: string;
  type: "text" | "image" | "embed";
  content: any;
  position: number;
}

interface DashboardBlocksProps {
  dashboardId: string;
}

function SortableBlockWrapper({
  block,
  onUpdate,
  onDelete,
  isDragging,
}: {
  block: DashboardBlock;
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
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {block.type === "text" && (
        <TextBlock
          id={block.id}
          content={block.content}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isDragging={isDragging}
        />
      )}
      {block.type === "image" && (
        <ImageBlock
          id={block.id}
          content={block.content}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isDragging={isDragging}
        />
      )}
      {block.type === "embed" && (
        <EmbedBlock
          id={block.id}
          content={block.content}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isDragging={isDragging}
        />
      )}
    </div>
  );
}

export default function DashboardBlocks({ dashboardId }: DashboardBlocksProps) {
  const [blocks, setBlocks] = useState<DashboardBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);

  // Load blocks
  useEffect(() => {
    loadBlocks();
  }, [dashboardId]);

  const loadBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from("dashboard_blocks")
        .select("*")
        .eq("dashboard_id", dashboardId)
        .order("position", { ascending: true });

      if (error) throw error;
      setBlocks(data || []);
    } catch (error) {
      console.error("Error loading blocks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlock = async (type: "text" | "image" | "embed") => {
    try {
      const maxPosition =
        blocks.length > 0
          ? Math.max(...blocks.map((b) => b.position))
          : -1;

      const { data, error } = await supabase
        .from("dashboard_blocks")
        .insert([
          {
            dashboard_id: dashboardId,
            type,
            content: type === "text" ? { text: "" } : {},
            position: maxPosition + 1,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setBlocks([...blocks, data]);
      setShowBlockMenu(false);
    } catch (error) {
      console.error("Error adding block:", error);
    }
  };

  const handleUpdateBlock = async (id: string, content: any) => {
    try {
      const { error } = await supabase
        .from("dashboard_blocks")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, content } : b))
      );
    } catch (error) {
      console.error("Error updating block:", error);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      const { error } = await supabase
        .from("dashboard_blocks")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Error deleting block:", error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newBlocks = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(newBlocks);

    // Update positions in database
    try {
      const updates = newBlocks.map((block, index) => ({
        id: block.id,
        position: index,
      }));

      await Promise.all(
        updates.map((update) =>
          supabase
            .from("dashboard_blocks")
            .update({ position: update.position })
            .eq("id", update.id)
        )
      );
    } catch (error) {
      console.error("Error updating block positions:", error);
      // Revert on error
      loadBlocks();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading blocks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Block Button */}
      <div className="relative">
        <button
          onClick={() => setShowBlockMenu(!showBlockMenu)}
          className="btn-secondary flex items-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Block
        </button>
        {showBlockMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowBlockMenu(false)}
            />
            <div className="absolute top-full left-0 mt-2 z-50">
              <BlockMenu
                onSelectBlockType={handleAddBlock}
                position={undefined}
              />
            </div>
          </>
        )}
      </div>

      {/* Blocks List */}
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {blocks.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No blocks yet. Click "Add Block" to get started.
              </div>
            ) : (
              blocks.map((block) => (
                <SortableBlockWrapper
                  key={block.id}
                  block={block}
                  onUpdate={handleUpdateBlock}
                  onDelete={handleDeleteBlock}
                  isDragging={activeId === block.id}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

