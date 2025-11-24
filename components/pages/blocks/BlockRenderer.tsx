"use client";

import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import GridBlock from "./GridBlock";
import KanbanBlock from "./KanbanBlock";
import CalendarBlock from "./CalendarBlock";
import TimelineBlock from "./TimelineBlock";
import GalleryBlock from "./GalleryBlock";
import ListBlock from "./ListBlock";
import ChartBlock from "./ChartBlock";
import KPIBlock from "./KPIBlock";
import TextBlock from "./TextBlock";
import ImageBlock from "./ImageBlock";
import ButtonBlock from "./ButtonBlock";
import RecordPickerBlock from "./RecordPickerBlock";
import FilterBlock from "./FilterBlock";
import DividerBlock from "./DividerBlock";
import { Component, ReactNode } from "react";

class BlockErrorBoundary extends Component<
  { children: ReactNode; blockId: string; blockType: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; blockId: string; blockType: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`Error in block ${this.props.blockId} (type: ${this.props.blockType}):`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
          <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
            Block Error
          </div>
          <div className="text-xs text-red-600 dark:text-red-300">
            {this.state.error?.message || "Failed to render block"}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function renderPageBlock(block: InterfacePageBlock) {
  const renderBlock = () => {
    switch (block.type) {
      case "grid":
        return <GridBlock block={block} />;
      case "kanban":
        return <KanbanBlock block={block} />;
      case "calendar":
        return <CalendarBlock block={block} />;
      case "timeline":
        return <TimelineBlock block={block} />;
      case "gallery":
        return <GalleryBlock block={block} />;
      case "list":
        return <ListBlock block={block} />;
      case "chart":
        return <ChartBlock block={block} />;
      case "kpi":
        return <KPIBlock block={block} />;
      case "text":
        return <TextBlock block={block} />;
      case "image":
        return <ImageBlock block={block} />;
      case "button":
        return <ButtonBlock block={block} />;
      case "record_picker":
        return <RecordPickerBlock block={block} />;
      case "filter":
        return <FilterBlock block={block} />;
      case "divider":
        return <DividerBlock block={block} />;
      default:
        return (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Unknown block type: {block.type}
          </div>
        );
    }
  };

  return (
    <BlockErrorBoundary blockId={block.id} blockType={block.type}>
      {renderBlock()}
    </BlockErrorBoundary>
  );
}

