"use client";

import React from "react";
import TextBlock from "./blocks/TextBlock";
import ImageBlock from "./blocks/ImageBlock";
import EmbedBlock from "./blocks/EmbedBlock";
import KpiBlock from "./blocks/KpiBlock";
import TableBlock from "./blocks/TableBlock";
import CalendarBlock from "./blocks/CalendarBlock";
import HtmlBlock from "./blocks/HtmlBlock";
import { DashboardBlock as DashboardBlockType } from "@/lib/hooks/useDashboardBlocks";

interface DashboardBlockProps {
  block: DashboardBlockType;
  isEditing: boolean;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
}

// Block component map for graceful failure
const blockComponents: Record<string, React.ComponentType<any>> = {
  text: TextBlock,
  image: ImageBlock,
  embed: EmbedBlock,
  kpi: KpiBlock,
  table: TableBlock,
  calendar: CalendarBlock,
  html: HtmlBlock,
};

export default function DashboardBlock({
  block,
  isEditing,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
}: DashboardBlockProps) {
  // Fail gracefully - prevent entire list from crashing
  if (!block?.type) {
    console.warn("DashboardBlock: Missing block type", block);
    return null;
  }

  if (!block?.content) {
    console.warn("DashboardBlock: Missing block content", block);
    return null;
  }

  const Component = blockComponents[block.type];
  if (!Component) {
    console.warn("DashboardBlock: Unknown block type", block.type);
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-500">
        Unknown block type: {block.type}
      </div>
    );
  }

  // Ensure content is always defined
  const safeContent = block.content || {};

  const commonProps = {
    id: block.id,
    content: safeContent,
    onUpdate: isEditing ? onUpdate : undefined,
    onDelete: isEditing ? onDelete : undefined,
    onOpenSettings: onOpenSettings, // Always available for settings button
    isDragging,
    editing: isEditing, // Pass editing state to blocks
  };

  // Wrap every block in a unified card container
  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
      <Component {...commonProps} />
    </div>
  );
}

