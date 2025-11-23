"use client";

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
  onUpdate: (id: string, content: any) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

export default function DashboardBlock({
  block,
  isEditing,
  onUpdate,
  onDelete,
  isDragging = false,
}: DashboardBlockProps) {
  const commonProps = {
    id: block.id,
    content: block.content,
    onUpdate: isEditing ? onUpdate : undefined,
    onDelete: isEditing ? onDelete : undefined,
    isDragging,
  };

  switch (block.type) {
    case "text":
      return <TextBlock {...commonProps} />;
    case "image":
      return <ImageBlock {...commonProps} />;
    case "embed":
      return <EmbedBlock {...commonProps} />;
    case "kpi":
      return <KpiBlock {...commonProps} />;
    case "table":
      return <TableBlock {...commonProps} />;
    case "calendar":
      return <CalendarBlock {...commonProps} />;
    case "html":
      return <HtmlBlock {...commonProps} />;
    default:
      return (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-500">
          Unknown block type: {block.type}
        </div>
      );
  }
}

