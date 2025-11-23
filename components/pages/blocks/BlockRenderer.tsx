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

export function renderPageBlock(block: InterfacePageBlock) {
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
}

